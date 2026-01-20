// Script de prueba para verificar conexión MQTT
import mqtt from "mqtt";

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://192.168.10.111:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "admin";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "admin1981";

console.log("=== Prueba de Conexión MQTT ===");
console.log("Broker:", MQTT_BROKER_URL);
console.log("Usuario:", MQTT_USERNAME);
console.log("Contraseña:", MQTT_PASSWORD ? "***" : "(vacía)");
console.log("");

const options = {
  clientId: `test-client-${Date.now()}`,
  clean: true,
  connectTimeout: 10000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  keepalive: 60,
};

console.log("Intentando conectar...");

const client = mqtt.connect(MQTT_BROKER_URL, options);

client.on("connect", () => {
  console.log("✅ ¡CONEXIÓN EXITOSA!");
  console.log("El broker MQTT está funcionando correctamente.");
  client.end();
  process.exit(0);
});

client.on("error", (err) => {
  console.error("❌ Error de conexión:", err.message);
  console.error("Código:", err.code);
  
  if (err.code === "EACCES") {
    console.error("\n💡 Posibles soluciones:");
    console.error("1. Verifica que el puerto 1883 no esté bloqueado por firewall");
    console.error("2. Verifica que el broker MQTT esté escuchando en 0.0.0.0 (no solo localhost)");
    console.error("3. Prueba hacer ping a la IP:", MQTT_BROKER_URL.replace("mqtt://", "").split(":")[0]);
    console.error("4. Verifica las credenciales en el broker");
    console.error("5. Si usas Mosquitto, verifica el archivo mosquitto.conf:");
    console.error("   listener 1883 0.0.0.0");
    console.error("   allow_anonymous false");
    console.error("   password_file /etc/mosquitto/passwd");
  } else if (err.code === "ECONNREFUSED") {
    console.error("\n💡 El broker no está corriendo o no acepta conexiones");
  } else if (err.code === "ETIMEDOUT") {
    console.error("\n💡 Timeout - verifica que el Raspberry PI esté en la misma red");
  }
  
  client.end();
  process.exit(1);
});

// Timeout después de 15 segundos
setTimeout(() => {
  console.error("❌ Timeout: No se pudo conectar en 15 segundos");
  client.end();
  process.exit(1);
}, 15000);
