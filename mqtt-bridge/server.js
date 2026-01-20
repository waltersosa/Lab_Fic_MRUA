import express from "express";
import cors from "cors";
import mqtt from "mqtt";
import { MongoClient } from "mongodb";

// ------------ Configuración ------------
const PORT = process.env.PORT || 3001;
const MQTT_BROKER_URL =
  process.env.MQTT_BROKER_URL || "mqtt://192.168.10.111:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "admin";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "admin1981";

const MQTT_TOPIC_CONTROL = process.env.MQTT_TOPIC_CONTROL || "mru/control";
const MQTT_TOPIC_DATA = process.env.MQTT_TOPIC_DATA || "mru/data";
const MQTT_TOPIC_STATUS = process.env.MQTT_TOPIC_STATUS || "mru/status";

// ------------ Estado en memoria ------------
let latestData = { tiempo: 0, distancia: 0, velocidad: 0 };
let latestStatus = "Listo";
let history = [];

// ------------ MongoDB ------------
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mru";
let mongoClient = null;
let colLatest = null;
let colHistory = null;

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const db = mongoClient.db();
    colLatest = db.collection("latest");
    colHistory = db.collection("history");
    console.log("[Mongo] conectado a", MONGO_URL);

    // Cargar último estado si existe
    const doc = await colLatest.findOne({ _id: "latest" });
    if (doc && doc.data) {
      latestData = doc.data;
      latestStatus = doc.status || latestStatus;
    }
    const hist = await colHistory
      .find({})
      .sort({ _id: -1 })
      .limit(50)
      .toArray();
    if (hist && hist.length) history = hist.map((h) => ({ ...h, id: h._id }));
  } catch (err) {
    console.error("[Mongo] No se pudo conectar:", err?.message || err);
    mongoClient = null;
  }
}

async function persistLatest() {
  if (!colLatest) return;
  try {
    await colLatest.updateOne(
      { _id: "latest" },
      { $set: { data: latestData, status: latestStatus, updatedAt: new Date() } },
      { upsert: true },
    );
  } catch (err) {
    console.error("[Mongo] persistLatest error:", err?.message || err);
  }
}

async function persistHistory(measurement) {
  if (!colHistory) return;
  try {
    await colHistory.insertOne({ ...measurement, _id: measurement.id });
    // Mantener tope 50
    const count = await colHistory.countDocuments();
    if (count > 50) {
      const cursor = colHistory.find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).skip(50);
      const toDelete = await cursor.toArray();
      if (toDelete.length) {
        await colHistory.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
      }
    }
  } catch (err) {
    console.error("[Mongo] persistHistory error:", err?.message || err);
  }
}

// ------------ MQTT Client ------------
console.log("[MQTT] Intentando conectar a:", MQTT_BROKER_URL);
console.log("[MQTT] Usuario:", MQTT_USERNAME);
console.log("[MQTT] Contraseña:", MQTT_PASSWORD ? "***" : "(vacía)");

const mqttOptions = {
  clientId: `mru-bridge-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  reconnectPeriod: 2000,
  connectTimeout: 10000, // 10 segundos timeout
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  // Opciones adicionales para debugging
  keepalive: 60,
  protocolVersion: 4, // MQTT 3.1.1
};

const mqttClient = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

mqttClient.on("connect", () => {
  console.log("[MQTT] ✅ Conectado exitosamente a", MQTT_BROKER_URL);
  mqttClient.subscribe([MQTT_TOPIC_DATA, MQTT_TOPIC_STATUS], (err) => {
    if (err) console.error("[MQTT] ❌ Error al suscribirse:", err);
    else console.log("[MQTT] ✅ Suscrito a", MQTT_TOPIC_DATA, "y", MQTT_TOPIC_STATUS);
  });
});

mqttClient.on("reconnect", () => {
  console.log("[MQTT] 🔄 Reintentando conexión...");
});

mqttClient.on("error", (err) => {
  console.error("[MQTT] ❌ Error de conexión:", err?.message || err);
  console.error("[MQTT] Código de error:", err?.code);
  console.error("[MQTT] Stack:", err?.stack);
  
  // Mensajes de ayuda según el tipo de error
  if (err?.code === "EACCES") {
    console.error("[MQTT] 💡 EACCES = Acceso denegado. Posibles causas:");
    console.error("   1. El puerto 1883 está bloqueado por firewall");
    console.error("   2. El broker MQTT no está escuchando en esa IP");
    console.error("   3. El broker solo escucha en localhost (127.0.0.1)");
    console.error("   4. Verifica que el broker esté corriendo en el Raspberry PI");
  } else if (err?.code === "ECONNREFUSED") {
    console.error("[MQTT] 💡 ECONNREFUSED = Conexión rechazada. Verifica:");
    console.error("   1. El broker MQTT está corriendo?");
    console.error("   2. La IP y puerto son correctos?");
  } else if (err?.code === "ETIMEDOUT") {
    console.error("[MQTT] 💡 ETIMEDOUT = Timeout. Verifica:");
    console.error("   1. El Raspberry PI está en la misma red?");
    console.error("   2. Puedes hacer ping a", MQTT_BROKER_URL.replace("mqtt://", "").split(":")[0]);
  }
});

mqttClient.on("close", () => {
  console.log("[MQTT] ⚠️ Conexión cerrada");
});

mqttClient.on("offline", () => {
  console.log("[MQTT] ⚠️ Cliente MQTT desconectado");
});

mqttClient.on("message", (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    if (topic === MQTT_TOPIC_DATA) {
      latestData = { ...msg };
      if (msg.tiempo !== undefined && msg.distancia !== undefined) {
        latestStatus = "Ejecutando";
      }
      persistLatest();
    }
    if (topic === MQTT_TOPIC_STATUS && msg.status) {
      latestStatus = msg.status;
      persistLatest();
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

// Actualizar estado
app.post("/make-server-761e42e2/experiment-status", (req, res) => {
  const { status } = req.body || {};
  if (status) {
    latestStatus = status;
    persistLatest();
  }
  res.json({ success: true, status: latestStatus });
});

// Datos
app.get("/make-server-761e42e2/experiment-data", (_req, res) => {
  res.json(latestData);
});

// Iniciar experimento (publica en MQTT)
app.post("/make-server-761e42e2/start-experiment", async (req, res) => {
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

// Detener experimento (publica comando STOP en MQTT)
app.post("/make-server-761e42e2/stop-experiment", async (req, res) => {
  if (!mqttClient.connected) {
    return res.status(500).json({ success: false, error: "MQTT no conectado" });
  }

  const message = JSON.stringify({ command: "stop", timestamp: Date.now() });
  mqttClient.publish(MQTT_TOPIC_CONTROL, message, { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] Error al publicar stop:", err);
      return res.status(500).json({ success: false, error: "MQTT publish error" });
    }
    latestStatus = "Listo";
    persistLatest();
    res.json({ success: true, message: "Comando STOP enviado al ESP32" });
  });
});

// Guardar medición en histórico (HTTP)
app.post("/make-server-761e42e2/save-measurement", (req, res) => {
  const { tiempo, distancia, velocidad, aceleracion, v12, v23, v34 } = req.body || {};
  const measurement = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    tiempo,
    distancia,
    velocidad,
    aceleracion,
    v12,
    v23,
    v34,
  };
  history.unshift(measurement);
  if (history.length > 50) history.splice(50);
  persistHistory(measurement);
  res.json({ success: true, measurement });
});

// Obtener histórico
app.get("/make-server-761e42e2/history", (_req, res) => {
  res.json({ history });
});

// Borrar histórico
app.delete("/make-server-761e42e2/history", (_req, res) => {
  history = [];
  if (colHistory) colHistory.deleteMany({}).catch((err) => console.error("[Mongo] clear history:", err));
  res.json({ success: true, message: "History cleared" });
});


app.listen(PORT, () => {
  console.log(`[HTTP] MQTT bridge escuchando en http://localhost:${PORT}`);
});

// Init Mongo (no bloqueante)
initMongo();
