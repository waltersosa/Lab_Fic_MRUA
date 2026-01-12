// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import mqtt from "npm:mqtt";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// MQTT Configuration
const MQTT_BROKER_URL = Deno.env.get("MQTT_BROKER_URL") || "mqtt://broker.hivemq.com:1883";
const MQTT_USERNAME = Deno.env.get("MQTT_USERNAME") || "";
const MQTT_PASSWORD = Deno.env.get("MQTT_PASSWORD") || "";
const MQTT_TOPIC_CONTROL = "mru/control";
const MQTT_TOPIC_DATA = "mru/data";
const MQTT_TOPIC_STATUS = "mru/status";

// MQTT Client setup
let mqttClient: any = null;
let isConnecting = false;

function getMqttClient() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  if (!isConnecting) {
    isConnecting = true;
    console.log("Connecting to MQTT broker:", MQTT_BROKER_URL);
    
    const options: any = {
      clientId: `mru-server-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 1000,
    };

    if (MQTT_USERNAME && MQTT_PASSWORD) {
      options.username = MQTT_USERNAME;
      options.password = MQTT_PASSWORD;
    }

    mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

    mqttClient.on("connect", () => {
      console.log("MQTT Connected successfully");
      isConnecting = false;
      
      // Subscribe to data and status topics
      mqttClient.subscribe(MQTT_TOPIC_DATA, (err: any) => {
        if (err) {
          console.error("MQTT Subscription error (data):", err);
        } else {
          console.log("Subscribed to", MQTT_TOPIC_DATA);
        }
      });
      
      mqttClient.subscribe(MQTT_TOPIC_STATUS, (err: any) => {
        if (err) {
          console.error("MQTT Subscription error (status):", err);
        } else {
          console.log("Subscribed to", MQTT_TOPIC_STATUS);
        }
      });
    });

    mqttClient.on("message", async (topic: string, message: Buffer) => {
      console.log("MQTT Message received:", topic, message.toString());
      
      if (topic === MQTT_TOPIC_DATA) {
        try {
          const data = JSON.parse(message.toString());
          // Store latest data
          await kv.set("experiment:latest", data);
          
          // Update status if experiment is running
          if (data.tiempo !== undefined && data.distancia !== undefined) {
            await kv.set("experiment:status", "Ejecutando");
          }
        } catch (error) {
          console.error("Error processing MQTT data message:", error);
        }
      }
      
      if (topic === MQTT_TOPIC_STATUS) {
        try {
          const statusData = JSON.parse(message.toString());
          if (statusData.status) {
            await kv.set("experiment:status", statusData.status);
            console.log("Status updated to:", statusData.status);
          }
        } catch (error) {
          console.error("Error processing MQTT status message:", error);
        }
      }
    });

    mqttClient.on("error", (error: any) => {
      console.error("MQTT Error:", error);
      isConnecting = false;
    });

    mqttClient.on("close", () => {
      console.log("MQTT Connection closed");
      isConnecting = false;
    });
  }

  return mqttClient;
}

// Health check endpoints (simple and namespaced)
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/make-server-761e42e2/health", (c) => {
  return c.json({ status: "ok" });
});

// Start experiment - publishes MQTT message
app.post("/make-server-761e42e2/start-experiment", async (c) => {
  try {
    const client = getMqttClient();
    
    if (!client || !client.connected) {
      return c.json({ 
        success: false, 
        error: "MQTT client not connected. Please check broker configuration." 
      }, 500);
    }

    // Update status to "Ejecutando"
    await kv.set("experiment:status", "Ejecutando");
    
    // Publish start command
    const message = JSON.stringify({ command: "start", timestamp: Date.now() });
    
    client.publish(MQTT_TOPIC_CONTROL, message, { qos: 1 }, (err: any) => {
      if (err) {
        console.error("MQTT Publish error:", err);
      } else {
        console.log("Published start command to MQTT");
      }
    });

    return c.json({ 
      success: true, 
      message: "Experiment started successfully",
      mqttTopic: MQTT_TOPIC_CONTROL
    });
  } catch (error) {
    console.error("Error starting experiment:", error);
    return c.json({ 
      success: false, 
      error: `Failed to start experiment: ${error}` 
    }, 500);
  }
});

// Get experiment status
app.get("/make-server-761e42e2/experiment-status", async (c) => {
  try {
    const status = await kv.get("experiment:status") || "Listo";
    return c.json({ status });
  } catch (error) {
    console.error("Error getting experiment status:", error);
    return c.json({ 
      success: false, 
      error: `Failed to get status: ${error}` 
    }, 500);
  }
});

// Update experiment status
app.post("/make-server-761e42e2/experiment-status", async (c) => {
  try {
    const { status } = await c.req.json();
    await kv.set("experiment:status", status);
    return c.json({ success: true, status });
  } catch (error) {
    console.error("Error updating experiment status:", error);
    return c.json({ 
      success: false, 
      error: `Failed to update status: ${error}` 
    }, 500);
  }
});

// Get latest experiment data
app.get("/make-server-761e42e2/experiment-data", async (c) => {
  try {
    const data = await kv.get("experiment:latest") || { tiempo: 0, distancia: 0, velocidad: 0 };
    return c.json(data);
  } catch (error) {
    console.error("Error getting experiment data:", error);
    return c.json({ 
      success: false, 
      error: `Failed to get data: ${error}` 
    }, 500);
  }
});

// Simulate data reception (for testing without physical hardware)
app.post("/make-server-761e42e2/simulate-data", async (c) => {
  try {
    const { tiempo, distancia, velocidad } = await c.req.json();
    
    const data = {
      tiempo: tiempo || 0,
      distancia: distancia || 0,
      velocidad: velocidad || 0,
      timestamp: Date.now()
    };

    await kv.set("experiment:latest", data);
    await kv.set("experiment:status", "Ejecutando");

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error simulating data:", error);
    return c.json({ 
      success: false, 
      error: `Failed to simulate data: ${error}` 
    }, 500);
  }
});

// Save measurement to history
app.post("/make-server-761e42e2/save-measurement", async (c) => {
  try {
    const { tiempo, distancia, velocidad } = await c.req.json();
    
    // Get existing history
    const history = await kv.get("experiment:history") || [];
    
    // Add new measurement
    const measurement = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      tiempo,
      distancia,
      velocidad,
    };
    
    history.unshift(measurement); // Add to beginning
    
    // Keep only last 50 measurements
    if (history.length > 50) {
      history.splice(50);
    }
    
    await kv.set("experiment:history", history);
    
    return c.json({ success: true, measurement });
  } catch (error) {
    console.error("Error saving measurement:", error);
    return c.json({ 
      success: false, 
      error: `Failed to save measurement: ${error}` 
    }, 500);
  }
});

// Get measurement history
app.get("/make-server-761e42e2/history", async (c) => {
  try {
    const history = await kv.get("experiment:history") || [];
    return c.json({ history });
  } catch (error) {
    console.error("Error getting history:", error);
    return c.json({ 
      success: false, 
      error: `Failed to get history: ${error}` 
    }, 500);
  }
});

// Clear history
app.delete("/make-server-761e42e2/history", async (c) => {
  try {
    await kv.set("experiment:history", []);
    return c.json({ success: true, message: "History cleared" });
  } catch (error) {
    console.error("Error clearing history:", error);
    return c.json({ 
      success: false, 
      error: `Failed to clear history: ${error}` 
    }, 500);
  }
});

// Note: we don't auto-connect on cold start to avoid failing health checks
// if the broker is unreachable. Connections are lazy inside handlers.
Deno.serve(app.fetch);
