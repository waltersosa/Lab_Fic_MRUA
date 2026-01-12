# 🚀 Código Arduino ESP32 - Experimento MRU con MQTT

## 📁 Contenido

- `MRU_Experiment_MQTT.ino` - Código principal para el ESP32

## ⚙️ Configuración Rápida

### 1. Instalar Librerías

En Arduino IDE, instala estas librerías:

```
Sketch > Include Library > Manage Libraries...
```

Busca e instala:
- **LiquidCrystal_I2C** (by Frank de Brabander)
- **ESP32Servo** (by Kevin Harrington)  
- **PubSubClient** (by Nick O'Leary) ⭐

### 2. Configurar Credenciales

Edita estas líneas en el archivo `.ino` (líneas 30-35):

```cpp
const char* ssid = "TU_WIFI_SSID";           // 🔧 Tu red WiFi
const char* password = "TU_WIFI_PASSWORD";   // 🔧 Tu contraseña WiFi

const char* mqtt_server = "broker.hivemq.com";  // 🔧 Broker MQTT
const int mqtt_port = 1883;
const char* mqtt_user = "";                     // Opcional
const char* mqtt_password = "";                 // Opcional
```

### 3. Cargar al ESP32

1. Conecta el ESP32 vía USB
2. Selecciona la placa: `Tools > Board > ESP32 Dev Module`
3. Selecciona el puerto: `Tools > Port > COM X`
4. Haz clic en **Upload** ➡️

## 🔌 Conexiones Hardware

### Sensores (Digital Output)
- Sensor Inicio → Pin **15**
- Sensor Fin → Pin **12**

### Motor DC (L298N Driver)
- ENA (PWM) → Pin **14**
- IN1 → Pin **27**
- IN2 → Pin **26**

### Servo
- Señal → Pin **5**

### Botón
- Botón → Pin **18** (con pull-up interno)

### LCD I2C
- SDA → Pin **21** (GPIO 21)
- SCL → Pin **22** (GPIO 22)
- Dirección I2C: **0x27**

## 📡 Topics MQTT

El código usa estos topics:

| Topic | Dirección | Descripción |
|-------|-----------|-------------|
| `mru/control` | ⬇️ Recibe | Comandos de inicio desde el dashboard |
| `mru/data` | ⬆️ Envía | Datos del experimento (tiempo, distancia, velocidad) |
| `mru/status` | ⬆️ Envía | Estado actual (Listo/Ejecutando/Finalizado) |

## 🧪 Uso

1. **Alimenta el ESP32** - Espera a ver "MRU Listo" en el LCD
2. **Verifica WiFi** - Debe mostrar la IP en el LCD
3. **Verifica MQTT** - Serial Monitor debe decir "MQTT conectado"
4. **Inicia experimento:**
   - Opción A: Presiona el botón físico (Pin 18)
   - Opción B: Haz clic en "Iniciar Experimento" en el dashboard web
5. **Mide automáticamente** - Los sensores detectan el paso del carrito
6. **Resultados enviados** - Datos publicados vía MQTT al dashboard

## 🐛 Solución de Problemas

### WiFi no conecta
- Verifica SSID y password
- Asegúrate de usar red 2.4 GHz (no 5 GHz)

### MQTT Error rc=-2
- Verifica que `mqtt_server` incluya solo el dominio (sin `mqtt://`)
- Ejemplo correcto: `broker.hivemq.com`
- Ejemplo incorrecto: `mqtt://broker.hivemq.com:1883`

### Sensores no detectan
- Verifica conexiones en pines 15 y 12
- Los sensores DO deben dar LOW cuando detectan objeto

### Motor no arranca
- Verifica conexiones L298N (pines 14, 27, 26)
- Asegúrate de que el motor tenga alimentación externa

## 📊 Formato de Datos MQTT

### Datos publicados (topic: `mru/data`):
```json
{
  "tiempo": 2.453,
  "distancia": 0.90,
  "velocidad": 0.367,
  "timestamp": 1234567890
}
```

### Estado publicado (topic: `mru/status`):
```json
{
  "status": "Ejecutando"
}
```

## ⚡ Características

- ✅ Control remoto vía MQTT
- ✅ Control local con botón físico
- ✅ Reconexión automática WiFi/MQTT
- ✅ Medición precisa con millis()
- ✅ Display LCD con resultados
- ✅ PWM para control de velocidad
- ✅ Distancia configurable (por defecto 0.9 m)

## 🔧 Personalización

### Cambiar distancia del experimento:
```cpp
float distancia = 0.9;  // Cambia a tu distancia en metros (línea 88)
```

### Ajustar velocidad del motor:
```cpp
const int velocidadMotor = 230;  // Rango: 0-255 (línea 82)
```

### Cambiar ángulos del servo:
```cpp
const int servoInicial = 0;    // Posición de reposo (línea 62)
const int servoEmpuje  = 60;   // Posición de empuje (línea 63)
```

## 📝 Notas

- El código usa `ledcAttach()` y `ledcWrite()` (ESP32 Arduino Core 3.0+)
- Si usas una versión anterior, cambia a `ledcSetup()` y `ledcAttachPin()`
- La distancia está fija en el código (no se recibe del dashboard)
- El auto-guardado ocurre cuando el ESP32 publica los datos

---

**¿Necesitas ayuda?** Revisa el archivo `/INSTRUCCIONES_ESP32.md` en la raíz del proyecto para más detalles.
