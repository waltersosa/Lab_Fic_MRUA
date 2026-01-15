/*
 * ================================================================
 * EXPERIMENTO MRUA (Movimiento Rectilíneo Uniformemente Acelerado) con MQTT
 * ================================================================
 * 
 * Este programa controla un experimento de física MRUA usando:
 * - Motor DC con PWM
 * - Servo para empujar el carrito
 * - 4 Sensores digitales para medir aceleración (S1, S2, S3, S4)
 * - Pantalla LCD I2C
 * - Conexión WiFi + MQTT para control remoto
 * 
 * Compatible con ESP32
 * 
 * LIBRERÍAS NECESARIAS:
 * - LiquidCrystal_I2C (by Frank de Brabander)
 * - ESP32Servo (by Kevin Harrington)
 * - PubSubClient (by Nick O'Leary)
 * 
 * ================================================================
 */

 #include <Wire.h>
 #include <LiquidCrystal_I2C.h>
 #include <ESP32Servo.h>
 #include <WiFi.h>
 #include <PubSubClient.h>
 
 // ============ CONFIGURACIÓN WIFI Y MQTT ============
 const char* ssid = "YolymellRosales3";               // 🔧 Cambia esto
 const char* password = "0802785477";       // 🔧 Cambia esto
 
 // Broker EMQX en Docker. Usa la IP/LAN de la máquina que corre Docker.
 const char* mqtt_server = "192.168.1.61";        // 🔧 Pon aquí la IP real de tu PC
 const int mqtt_port = 1883;
 const char* mqtt_user = "admin";
 const char* mqtt_password = "admin";
 
 // Topics MQTT
 const char* topic_control = "mru/control";
 const char* topic_data = "mru/data";
 const char* topic_status = "mru/status";
 
 WiFiClient espClient;
 PubSubClient client(espClient);
 
 // ---------------- LCD ----------------
 LiquidCrystal_I2C lcd(0x27, 16, 2);
 
// ---------------- PINES ----------------
// Sensores DO (MRUA 4 sensores)
const int S1 = 15;  // inicio
const int S2 = 25;
const int S3 = 12;
const int S4 = 13;

// Botón
const int pinBoton = 18;
 
 // Servo
 const int pinServo = 5;
 Servo servoCarrito;
 const int servoInicial = 0;
 const int servoEmpuje  = 60;
 
 // Driver motor
 const int ENA = 14;   // PWM
 const int IN1 = 27;
 const int IN2 = 26;
 
 // ---------------- PWM MOTOR ----------------
const int pwmFreq = 1000;      // Hz
const int pwmResolucion = 8;   // 0–255
int velocidadMotor = 230;      // se ajusta por MQTT (baja=210, alta=250)
 
// ---------------- MRUA ----------------
const float d = 0.50;  // distancia entre sensores (metros)
unsigned long t1=0, t2=0, t3=0, t4=0;
bool f1=false, f2=false, f3=false, f4=false;
bool empujeActivo = false;
unsigned long tiempoEmpuje = 0;
bool botonAnterior = HIGH;
 
 // Control experimento MQTT
 bool experimentoActivo = false;
 
 // ============ FUNCIONES WIFI ============
 void setup_wifi() {
   delay(10);
   Serial.println();
   Serial.print("Conectando a ");
   Serial.println(ssid);
 
   lcd.clear();
   lcd.print("Conectando WiFi");
   
   WiFi.begin(ssid, password);
   
   int intentos = 0;
   while (WiFi.status() != WL_CONNECTED && intentos < 20) {
     delay(500);
     Serial.print(".");
     intentos++;
   }
   
   if (WiFi.status() == WL_CONNECTED) {
     Serial.println("\nWiFi conectado");
     Serial.print("IP: ");
     Serial.println(WiFi.localIP());
     
     lcd.clear();
     lcd.print("WiFi OK");
     lcd.setCursor(0, 1);
     lcd.print(WiFi.localIP());
     delay(2000);
   } else {
     Serial.println("\nError WiFi");
     lcd.clear();
     lcd.print("Error WiFi");
     delay(2000);
   }
 }
 
 // ============ CALLBACK MQTT ============
 void callback(char* topic, byte* payload, unsigned int length) {
   Serial.print("Mensaje en [");
   Serial.print(topic);
   Serial.print("]: ");
   
   String mensaje = "";
   for (int i = 0; i < length; i++) {
     mensaje += (char)payload[i];
   }
   Serial.println(mensaje);
   
 // Si recibe comando "start" en topic control
 if (String(topic) == topic_control) {
   if (mensaje.indexOf("start") >= 0) {
     Serial.println("¡Comando INICIAR recibido por MQTT!");
     iniciarExperimento();
   }
 }
}
 
 // ============ RECONECTAR MQTT ============
 void reconnect() {
   while (!client.connected()) {
     Serial.print("Conectando MQTT...");
     lcd.clear();
     lcd.print("Conectando MQTT");
     
     String clientId = "ESP32-MRU-";
     clientId += String(random(0xffff), HEX);
     
     bool conectado;
     if (mqtt_user && strlen(mqtt_user) > 0) {
       conectado = client.connect(clientId.c_str(), mqtt_user, mqtt_password);
     } else {
       conectado = client.connect(clientId.c_str());
     }
     
     if (conectado) {
       Serial.println("conectado");
       
       // Suscribirse al topic de control
       client.subscribe(topic_control);
       Serial.print("Suscrito a: ");
       Serial.println(topic_control);
       
       // Publicar estado inicial
       client.publish(topic_status, "{\"status\":\"Listo\"}");
       
       lcd.clear();
       lcd.print("MQTT OK");
       delay(1000);
     } else {
       Serial.print("Error, rc=");
       Serial.print(client.state());
       Serial.println(" reintento en 5s");
       
       lcd.setCursor(0, 1);
       lcd.print("Reintentando...");
       delay(5000);
     }
   }
 }
 
 // ============ INICIAR EXPERIMENTO ============
 void iniciarExperimento() {
   if (empujeActivo) {
     Serial.println("Experimento ya en curso");
     return;
   }
   
   experimentoActivo = true;
   
   Serial.print("Motor PWM = ");
   Serial.println(velocidadMotor);
   
   // Motor
   digitalWrite(IN1, LOW);
   digitalWrite(IN2, HIGH);
   ledcWrite(ENA, velocidadMotor);
   
   // Servo empuje
   servoCarrito.write(servoEmpuje);
   empujeActivo = true;
   tiempoEmpuje = millis();
   
   lcd.clear();
   lcd.print("Empujando...");
   
   // Publicar estado
   client.publish(topic_status, "{\"status\":\"Ejecutando\"}");
 }
 
// ============ PUBLICAR DATOS MQTT ============
void publicarDatos(float tTotal, float velocidad, float aceleracion, float v12, float v23, float v34, float t12, float t23, float t34) {
  // Crear JSON con los datos + tiempos intermedios para graficar
  String json = "{";
  json += "\"tiempo\":" + String(tTotal, 3) + ",";
  json += "\"distancia\":" + String(d * 3, 2) + ",";  // distancia total = 3 tramos
  json += "\"velocidad\":" + String(velocidad, 3) + ",";
  json += "\"aceleracion\":" + String(aceleracion, 3) + ",";
  json += "\"v12\":" + String(v12, 3) + ",";
  json += "\"v23\":" + String(v23, 3) + ",";
  json += "\"v34\":" + String(v34, 3) + ",";
  json += "\"t12\":" + String(t12, 3) + ",";  // tiempo acumulado al llegar a S2
  json += "\"t23\":" + String(t23, 3) + ",";  // tiempo acumulado al llegar a S3
  json += "\"t34\":" + String(t34, 3) + ",";  // tiempo acumulado al llegar a S4 (=tTotal)
  json += "\"timestamp\":" + String(millis());
  json += "}";
  
  Serial.print("Publicando: ");
  Serial.println(json);
  
  client.publish(topic_data, json.c_str());
}
 
 // ============ SETUP ============
 void setup() {
   Serial.begin(115200);
   
  pinMode(S1, INPUT_PULLUP);
  pinMode(S2, INPUT_PULLUP);
  pinMode(S3, INPUT_PULLUP);
  pinMode(S4, INPUT_PULLUP);
  pinMode(pinBoton, INPUT_PULLUP);
   pinMode(IN1, OUTPUT);
   pinMode(IN2, OUTPUT);
   
   ledcAttach(ENA, pwmFreq, pwmResolucion);
   ledcWrite(ENA, 0);
   
   digitalWrite(IN1, LOW);
   digitalWrite(IN2, LOW);
   
   servoCarrito.setPeriodHertz(50);
   servoCarrito.attach(pinServo, 500, 2400);
   servoCarrito.write(servoInicial);
   
  lcd.init();
  lcd.backlight();
  lcd.print("MRUA + MQTT");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");
  
  Serial.println("=== MRUA + MQTT ===");
   
   // Conectar WiFi
   setup_wifi();
   
   // Configurar MQTT
   client.setServer(mqtt_server, mqtt_port);
   client.setCallback(callback);
   
  lcd.clear();
  lcd.print("MRUA Listo");
  lcd.setCursor(0, 1);
  lcd.print("Boton o MQTT");
 }
 
 // ============ LOOP ============
 void loop() {
   // Mantener conexión MQTT
   if (!client.connected()) {
     reconnect();
   }
   client.loop();
   
   // -------- BOTÓN FÍSICO --------
   bool botonActual = digitalRead(pinBoton);
   
   if (botonAnterior == HIGH && botonActual == LOW) {
     iniciarExperimento();
   }
   
   botonAnterior = botonActual;
   
   // -------- RETORNO SERVO --------
   if (empujeActivo && millis() - tiempoEmpuje >= 5000) {
     servoCarrito.write(servoInicial);
     ledcWrite(ENA, 0);
     digitalWrite(IN1, LOW);
     digitalWrite(IN2, LOW);
     empujeActivo = false;
     Serial.println("Motor OFF");
   }
   
  // -------- DETECCIÓN SENSORES MRUA --------
  if (!f1 && digitalRead(S1) == LOW) {
    t1 = millis();
    f1 = true;
    Serial.println("S1 detectado");
    lcd.clear();
    lcd.print("Midiendo...");
    delay(50);
  }

  if (f1 && !f2 && digitalRead(S2) == LOW) {
    t2 = millis();
    f2 = true;
    Serial.println("S2 detectado");
    delay(50);
  }

  if (f2 && !f3 && digitalRead(S3) == LOW) {
    t3 = millis();
    f3 = true;
    Serial.println("S3 detectado");
    delay(50);
  }

  if (f3 && !f4 && digitalRead(S4) == LOW) {
    t4 = millis();
    f4 = true;
    Serial.println("S4 detectado");
    
    // Calcular y publicar MRUA
    calcularMRUA();
    
    delay(4000);
    resetSistema();
  }
   
   delay(2);
 }
 
// ============ CALCULAR MRUA ============
void calcularMRUA() {
  float t12 = (t2 - t1) / 1000.0;
  float t23 = (t3 - t2) / 1000.0;
  float t34 = (t4 - t3) / 1000.0;
  float tTotal = (t4 - t1) / 1000.0;

  // Evitar división por cero
  if (t12 <= 0) t12 = 0.001;
  if (t23 <= 0) t23 = 0.001;
  if (t34 <= 0) t34 = 0.001;
  if (tTotal <= 0) tTotal = 0.001;

  float v12 = d / t12;
  float v23 = d / t23;
  float v34 = d / t34;
  float vProm = (d * 3) / tTotal;

  // Aceleración promedio entre tramos
  float a1 = (v23 - v12) / t23;
  float a2 = (v34 - v23) / t34;
  float a = (a1 + a2) / 2.0;

  // Mostrar en LCD
  lcd.clear();
  lcd.print("t=");
  lcd.print(tTotal, 2);
  lcd.print("s a=");
  lcd.print(a, 2);
  
  lcd.setCursor(0, 1);
  lcd.print("v=");
  lcd.print(vProm, 2);
  lcd.print(" m/s");

  // Serial
  Serial.print("tTotal: "); Serial.println(tTotal, 3);
  Serial.print("v12: "); Serial.println(v12, 3);
  Serial.print("v23: "); Serial.println(v23, 3);
  Serial.print("v34: "); Serial.println(v34, 3);
  Serial.print("a: "); Serial.println(a, 3);

  // Tiempos acumulados desde t1 (para graficar)
  float tAcum12 = (t2 - t1) / 1000.0;
  float tAcum23 = (t3 - t1) / 1000.0;
  float tAcum34 = (t4 - t1) / 1000.0;

  // Publicar en MQTT
  publicarDatos(tTotal, vProm, a, v12, v23, v34, tAcum12, tAcum23, tAcum34);

  // Publicar estado finalizado
  client.publish(topic_status, "{\"status\":\"Finalizado\"}");
}

// ============ RESET ============
void resetSistema() {
  f1 = f2 = f3 = f4 = false;
  experimentoActivo = false;
  
  lcd.clear();
  lcd.print("MRUA Listo");
  lcd.setCursor(0, 1);
  lcd.print("Nueva prueba");
  
  // Publicar estado listo
  client.publish(topic_status, "{\"status\":\"Listo\"}");
  
  Serial.println("Reinicio\n");
}