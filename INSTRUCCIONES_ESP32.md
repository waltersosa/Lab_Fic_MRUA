# 📡 Instrucciones de Configuración ESP32 - Experimento MRU

## 🔧 Configuración del Código Arduino

### 1. Librerías Necesarias

Instala las siguientes librerías en Arduino IDE:

```
- LiquidCrystal_I2C (by Frank de Brabander)
- ESP32Servo (by Kevin Harrington)
- PubSubClient (by Nick O'Leary) ⭐ NUEVA
```

**Para instalar:**
1. Abre Arduino IDE
2. Ve a `Sketch > Include Library > Manage Libraries...`
3. Busca cada librería por nombre
4. Haz clic en "Install"

---

### 2. Configuración WiFi y MQTT

En el código Arduino proporcionado, modifica estas líneas (cerca de la línea 8):

```cpp
// ⚠️ CONFIGURAR ESTAS VARIABLES
const char* ssid = "TU_WIFI_SSID";           // Nombre de tu red WiFi
const char* password = "TU_WIFI_PASSWORD";   // Contraseña WiFi

const char* mqtt_server = "broker.hivemq.com";  // URL del broker MQTT
const int mqtt_port = 1883;                     // Puerto MQTT
const char* mqtt_user = "";                     // Usuario MQTT (vacío si no se requiere)
const char* mqtt_password = "";                 // Password MQTT (vacío si no se requiere)
```

#### Opciones de Broker MQTT:

**Opción 1: HiveMQ Público (Sin autenticación)**
```cpp
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* mqtt_user = "";
const char* mqtt_password = "";
```

**Opción 2: Mosquitto Público (Sin autenticación)**
```cpp
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;
const char* mqtt_user = "";
const char* mqtt_password = "";
```

**Opción 3: Broker Privado (Con autenticación)**
```cpp
const char* mqtt_server = "tu-broker.com";
const int mqtt_port = 1883;
const char* mqtt_user = "tu_usuario";
const char* mqtt_password = "tu_password";
```

---

### 3. Topics MQTT Configurados

El sistema usa estos topics automáticamente:

- `mru/control` - Recibe comandos de inicio desde el dashboard
- `mru/data` - Publica datos del experimento (tiempo, distancia, velocidad)
- `mru/status` - Publica el estado (Listo, Ejecutando, Finalizado)

⚠️ **No es necesario cambiar los nombres de los topics** a menos que quieras personalizarlos.

---

## 🌐 Configuración del Dashboard Web

### 1. Variables de Entorno en Supabase

Debes configurar las mismas credenciales MQTT en el dashboard:

1. Ve a la configuración de Supabase
2. Configura estas 3 variables de entorno:

```
MQTT_BROKER_URL = mqtt://broker.hivemq.com:1883
MQTT_USERNAME = (vacío o tu usuario)
MQTT_PASSWORD = (vacío o tu password)
```

**Importante:** El `MQTT_BROKER_URL` debe incluir el protocolo `mqtt://` o `mqtts://` y el puerto.

---

## 🚀 Proceso de Carga y Prueba

### Paso 1: Cargar el Código al ESP32

1. Navega a la carpeta `/arduino` del proyecto
2. Abre el archivo `MRU_Experiment_MQTT.ino` en Arduino IDE
3. Modifica las credenciales WiFi y MQTT (líneas 30-35)
4. Conecta tu ESP32 vía USB
5. Selecciona:
   - **Board:** "ESP32 Dev Module" (o tu modelo específico)
   - **Port:** El puerto COM/USB correspondiente
6. Haz clic en **Upload** ✅

### Paso 2: Verificar Conexión

1. Abre el **Serial Monitor** (115200 baud)
2. Deberías ver:
   ```
   === MRU + MQTT ===
   Conectando a TU_WIFI_SSID...
   WiFi conectado
   IP: 192.168.x.x
   Conectando MQTT...conectado
   Suscrito a: mru/control
   ```

3. En el **LCD** deberías ver:
   ```
   MRU Listo
   Boton o MQTT
   ```

### Paso 3: Probar desde el Dashboard

1. Abre el dashboard web
2. Haz clic en **"Iniciar Experimento"**
3. El ESP32 debería:
   - Recibir el comando vía MQTT
   - Activar el motor y servo
   - Mostrar "Empujando..." en el LCD

### Paso 4: Realizar una Medición

1. El carrito se empujará automáticamente
2. Pasará por los sensores de inicio y fin
3. El ESP32 calculará tiempo y velocidad
4. Publicará los datos vía MQTT
5. El dashboard mostrará:
   - Los valores en tiempo real
   - La gráfica actualizada
   - El cálculo del MRU
   - La medición guardada en el historial
   - **Video en vivo** de la cámara del dispositivo 📹

### Paso 5: Usar el Monitoreo por Cámara

1. El dashboard solicitará permiso para acceder a la cámara
2. Haz clic en **"Permitir"** cuando el navegador lo solicite
3. La cámara se activará automáticamente al iniciar el experimento
4. Posiciona tu dispositivo (tablet/laptop) para enfocar el experimento
5. Verás el video en vivo con indicador "EN VIVO" 🔴
6. Puedes detener la cámara con el botón "Detener Cámara"

**Consejos para el monitoreo:**
- Usa un trípode o soporte para estabilizar el dispositivo
- Asegúrate de tener buena iluminación
- En móviles, prefiere la cámara trasera (se activa automáticamente)
- La cámara se puede activar/desactivar manualmente en cualquier momento

---

## 🐛 Solución de Problemas

### Error: WiFi no conecta

**Síntomas:** LCD muestra "Error WiFi"

**Solución:**
- Verifica el SSID y password
- Asegúrate de estar en rango del WiFi
- Usa una red de 2.4 GHz (ESP32 no soporta 5 GHz)

---

### Error: MQTT no conecta

**Síntomas:** Serial Monitor muestra "Error, rc=-2 reintento en 5s"

**Solución:**
- Verifica la URL del broker (debe incluir `mqtt://`)
- Prueba con un broker público sin autenticación primero
- Revisa que el puerto sea 1883 (o 8883 para SSL)

**Códigos de error MQTT:**
- `-2` = Error de conexión de red
- `-4` = Timeout
- `5` = Autenticación fallida

---

### El dashboard no recibe datos

**Síntomas:** Dashboard muestra "0.00" en todos los valores

**Solución:**
1. Verifica que el ESP32 esté conectado a MQTT (Serial Monitor)
2. Verifica las variables de entorno en Supabase
3. Asegúrate de usar el **mismo broker** en ESP32 y dashboard
4. Prueba el botón "Simular Datos (Test)" en el dashboard

---

### Los sensores no detectan

**Síntomas:** El carrito se mueve pero no se registran datos

**Solución:**
- Verifica las conexiones de los sensores (pines 15 y 12)
- Los sensores DO deben usar INPUT_PULLUP
- Asegúrate de que los sensores estén alineados con el carrito
- Revisa que la distancia sea correcta (0.9 m por defecto)

---

## 📊 Formato de Datos MQTT

### Comando de Inicio (topic: mru/control)
```json
{
  "command": "start",
  "timestamp": 1234567890
}
```

### Datos del Experimento (topic: mru/data)
```json
{
  "tiempo": 2.453,
  "distancia": 0.90,
  "velocidad": 0.367,
  "timestamp": 1234567890
}
```

### Estado (topic: mru/status)
```json
{
  "status": "Ejecutando"
}
```

Valores de status: `"Listo"`, `"Ejecutando"`, `"Finalizado"`

---

## ⚙️ Ajustes Avanzados

### Cambiar la distancia del experimento

Modifica en el código Arduino (línea ~75):
```cpp
float distancia = 0.9;  // Cambia a tu distancia en metros
```

### Ajustar velocidad del motor

Modifica en el código Arduino (línea ~33):
```cpp
const int velocidadMotor = 230;  // Rango: 0-255
```

### Cambiar ángulo del servo

Modifica en el código Arduino (líneas ~29-30):
```cpp
const int servoInicial = 0;    // Posición de reposo
const int servoEmpuje  = 60;   // Posición de empuje
```

---

## 📌 Notas Importantes

1. **Seguridad:** Si usas un broker público, tus datos son visibles. Para producción, usa un broker privado.

2. **Distancia fija:** El código asume distancia fija de 0.9 m. Si tu pista es diferente, cámbiala en el código.

3. **Auto-guardado:** El dashboard guarda automáticamente las mediciones cuando llegan del ESP32.

4. **Modo test:** El botón "Simular Datos (Test)" en el dashboard genera datos aleatorios sin necesidad del hardware.

5. **Reconexión automática:** El ESP32 se reconecta automáticamente si pierde WiFi o MQTT.

---

## ✅ Checklist de Configuración

- [ ] Librerías instaladas (LiquidCrystal_I2C, ESP32Servo, PubSubClient)
- [ ] Credenciales WiFi configuradas en código Arduino
- [ ] Broker MQTT configurado en código Arduino
- [ ] Variables de entorno MQTT configuradas en Supabase
- [ ] Código cargado al ESP32
- [ ] ESP32 conectado a WiFi (verificar Serial Monitor)
- [ ] ESP32 conectado a MQTT (verificar Serial Monitor)
- [ ] Dashboard web abierto
- [ ] Prueba exitosa con "Iniciar Experimento"

---

## 🆘 Soporte

Si tienes problemas:

1. Revisa el Serial Monitor a 115200 baud
2. Verifica las conexiones físicas de sensores y motor
3. Prueba primero con un broker MQTT público sin autenticación
4. Usa el botón "Simular Datos" para verificar que el dashboard funciona

**¡Buena suerte con tu experimento MRU! 🚀📐**