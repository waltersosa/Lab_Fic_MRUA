import express from "express";
import cors from "cors";
import mqtt from "mqtt";

// ------------ Configuración ------------
const PORT = process.env.PORT || 3001;
const MQTT_BROKER_URL =
  process.env.MQTT_BROKER_URL || "mqtt://192.168.1.61:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "admin";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "admin";

const MQTT_TOPIC_CONTROL = process.env.MQTT_TOPIC_CONTROL || "mru/control";
const MQTT_TOPIC_DATA = process.env.MQTT_TOPIC_DATA || "mru/data";
const MQTT_TOPIC_STATUS = process.env.MQTT_TOPIC_STATUS || "mru/status";

// ------------ Estado en memoria ------------
let latestData = { tiempo: 0, distancia: 0, velocidad: 0 };
let latestStatus = "Listo";
let history = [];

// ------------ MQTT Client ------------
const mqttOptions = {
  clientId: `mru-bridge-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  reconnectPeriod: 2000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
};

const mqttClient = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

mqttClient.on("connect", () => {
  console.log("[MQTT] Conectado a", MQTT_BROKER_URL);
  mqttClient.subscribe([MQTT_TOPIC_DATA, MQTT_TOPIC_STATUS], (err) => {
    if (err) console.error("[MQTT] Error al suscribirse:", err);
    else console.log("[MQTT] Suscrito a", MQTT_TOPIC_DATA, "y", MQTT_TOPIC_STATUS);
  });
});

mqttClient.on("reconnect", () => console.log("[MQTT] Reconnecting..."));
mqttClient.on("error", (err) => console.error("[MQTT] Error:", err?.message || err));

mqttClient.on("message", (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    if (topic === MQTT_TOPIC_DATA) {
      latestData = { ...msg };
      if (msg.tiempo !== undefined && msg.distancia !== undefined) {
        latestStatus = "Ejecutando";
      }
    }
    if (topic === MQTT_TOPIC_STATUS && msg.status) {
      latestStatus = msg.status;
    }
  } catch (e) {
    console.error("[MQTT] Error parseando mensaje:", e);
  }
});

// ------------ HTTP Server ------------
const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/make-server-761e42e2/health", (_req, res) => res.json({ status: "ok" }));

// Estado
app.get("/make-server-761e42e2/experiment-status", (_req, res) => {
  res.json({ status: latestStatus });
});

// Datos
app.get("/make-server-761e42e2/experiment-data", (_req, res) => {
  res.json(latestData);
});

// Iniciar experimento (publica en MQTT)
app.post("/make-server-761e42e2/start-experiment", async (_req, res) => {
  if (!mqttClient.connected) {
    return res.status(500).json({ success: false, error: "MQTT no conectado" });
  }
  const message = JSON.stringify({ command: "start", timestamp: Date.now() });
  mqttClient.publish(MQTT_TOPIC_CONTROL, message, { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] Error al publicar:", err);
      return res.status(500).json({ success: false, error: "MQTT publish error" });
    }
    latestStatus = "Ejecutando";
    res.json({ success: true, mqttTopic: MQTT_TOPIC_CONTROL });
  });
});

// Guardar medición en histórico (HTTP)
app.post("/make-server-761e42e2/save-measurement", (req, res) => {
  const { tiempo, distancia, velocidad } = req.body || {};
  const measurement = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    tiempo,
    distancia,
    velocidad,
  };
  history.unshift(measurement);
  if (history.length > 50) history.splice(50);
  res.json({ success: true, measurement });
});

// Obtener histórico
app.get("/make-server-761e42e2/history", (_req, res) => {
  res.json({ history });
});

// Borrar histórico
app.delete("/make-server-761e42e2/history", (_req, res) => {
  history = [];
  res.json({ success: true, message: "History cleared" });
});

// Simular datos
app.post("/make-server-761e42e2/simulate-data", (req, res) => {
  const { tiempo = 0, distancia = 0, velocidad = 0 } = req.body || {};
  latestData = { tiempo, distancia, velocidad, timestamp: Date.now() };
  latestStatus = "Ejecutando";
  res.json({ success: true, data: latestData });
});

app.listen(PORT, () => {
  console.log(`[HTTP] MQTT bridge escuchando en http://localhost:${PORT}`);
});
