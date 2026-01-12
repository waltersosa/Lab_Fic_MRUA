# 🚀 Sistema de Control de Experimento MRU

Dashboard web profesional para controlar y monitorear experimentos de **Movimiento Rectilíneo Uniforme (MRU)** mediante MQTT, con integración ESP32 y video en vivo.

![MRU Dashboard](https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80)

## ✨ Características Principales

### 📊 Dashboard Web Interactivo
- **Panel de control** con botón de inicio remoto vía MQTT
- **Tarjetas de datos** en tiempo real (Tiempo, Distancia, Velocidad)
- **Gráfica dinámica** Distancia vs Tiempo con Recharts
- **Cálculo automático** del MRU paso a paso (fórmula, sustitución, resultado)
- **Historial de mediciones** con tabla completa
- **Video en vivo** 📹 desde la cámara del dispositivo para monitorear el experimento
- **Diseño responsive** para desktop, tablet y móvil

### 🔌 Integración Hardware ESP32
- Control remoto del experimento vía MQTT
- Sensores de inicio y fin para medición automática
- Motor DC con PWM para impulso del carrito
- Servo para mecanismo de empuje
- Display LCD I2C con resultados
- Botón físico alternativo

### 🌐 Comunicación MQTT en Tiempo Real
- Publicación/suscripción de datos
- Topics configurables
- Reconexión automática
- Compatible con brokers públicos y privados

## 📁 Estructura del Proyecto

```
/
├── src/
│   └── app/
│       ├── App.tsx                    # Dashboard principal
│       └── components/
│           └── CameraStream.tsx       # Componente de cámara
├── arduino/
│   ├── MRU_Experiment_MQTT.ino       # Código ESP32
│   └── README.md                      # Guía Arduino
├── supabase/
│   └── functions/
│       └── server/
│           └── index.tsx              # Servidor MQTT
└── INSTRUCCIONES_ESP32.md            # Guía completa
```

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

En Supabase, configura:

```
MQTT_BROKER_URL = mqtt://broker.hivemq.com:1883
MQTT_USERNAME = (opcional)
MQTT_PASSWORD = (opcional)
```

### 2. Cargar Código al ESP32

1. Abre `/arduino/MRU_Experiment_MQTT.ino`
2. Configura WiFi y MQTT (líneas 30-35)
3. Instala librerías: `LiquidCrystal_I2C`, `ESP32Servo`, `PubSubClient`
4. Carga al ESP32

### 3. Abrir Dashboard

1. Accede al dashboard web
2. Permite acceso a la cámara cuando se solicite
3. Haz clic en "Iniciar Experimento"
4. Observa los datos en tiempo real y el video

## 📡 Topics MQTT

| Topic | Tipo | Descripción |
|-------|------|-------------|
| `mru/control` | Subscribe | Comandos de inicio del dashboard |
| `mru/data` | Publish | Datos del experimento (tiempo, distancia, velocidad) |
| `mru/status` | Publish | Estado actual (Listo/Ejecutando/Finalizado) |

## 🔧 Configuración Hardware

### Conexiones ESP32

```
Sensores:
├─ Sensor Inicio → Pin 15
└─ Sensor Fin    → Pin 12

Motor L298N:
├─ ENA (PWM) → Pin 14
├─ IN1       → Pin 27
└─ IN2       → Pin 26

Servo:
└─ Señal     → Pin 5

Botón:
└─ Pin       → Pin 18 (con pull-up)

LCD I2C (0x27):
├─ SDA       → Pin 21
└─ SCL       → Pin 22
```

## 📹 Monitoreo por Cámara

El dashboard incluye streaming de video en vivo para monitorear el experimento:

- **Auto-activación** al iniciar el experimento
- **Preferencia cámara trasera** en dispositivos móviles
- **Indicador EN VIVO** con animación
- **Controles** para activar/desactivar manualmente
- **Diseño adaptativo** con aspect ratio 16:9

### Permisos de Cámara

Al abrir el dashboard, el navegador solicitará permiso para acceder a la cámara. Es necesario aceptar para usar esta funcionalidad.

## 🎯 Uso del Sistema

### Modo Automático (MQTT)
1. Abre el dashboard web
2. Posiciona el dispositivo para enfocar el experimento
3. Haz clic en "Iniciar Experimento"
4. El ESP32 recibe el comando vía MQTT
5. El carrito se impulsa automáticamente
6. Los sensores miden el recorrido
7. Los datos se envían al dashboard en tiempo real
8. La medición se guarda automáticamente en el historial

### Modo Manual (Botón Físico)
1. Presiona el botón en el ESP32 (Pin 18)
2. El resto del proceso es igual
3. Los datos se publican vía MQTT al dashboard

### Modo Test (Sin Hardware)
1. Haz clic en "Simular Datos (Test)"
2. Se generan datos aleatorios para probar el dashboard
3. Útil para desarrollo y demostración

## 🧮 Cálculo del MRU

El dashboard muestra paso a paso:

```
Fórmula:        v = d / t
Sustitución:    v = 0.90 m / 2.45 s
Resultado:      v = 0.367 m/s
```

Compara la **velocidad calculada** con la **velocidad medida** para verificar la precisión del experimento.

## 📊 Formato de Datos

### Publicación de datos (ESP32 → Dashboard)
```json
{
  "tiempo": 2.453,
  "distancia": 0.90,
  "velocidad": 0.367,
  "timestamp": 1234567890
}
```

### Comando de inicio (Dashboard → ESP32)
```json
{
  "command": "start",
  "timestamp": 1234567890
}
```

## 🛠️ Tecnologías Utilizadas

### Frontend
- React 18
- TypeScript
- Tailwind CSS v4
- Recharts (gráficas)
- Lucide React (iconos)
- getUserMedia API (cámara)

### Backend
- Deno
- Hono (servidor)
- MQTT.js
- Supabase (base de datos y hosting)

### Hardware
- ESP32
- Arduino C++
- PubSubClient (MQTT)
- ESP32Servo
- LiquidCrystal_I2C

## 📖 Documentación

- **[INSTRUCCIONES_ESP32.md](/INSTRUCCIONES_ESP32.md)** - Guía completa de configuración
- **[arduino/README.md](/arduino/README.md)** - Detalles del código Arduino

## 🐛 Solución de Problemas

### La cámara no funciona
- Verifica que hayas dado permisos al navegador
- Usa HTTPS (requerido para getUserMedia)
- Prueba en un navegador compatible (Chrome, Firefox, Safari)
- Revisa la consola del navegador para errores

### ESP32 no conecta a MQTT
- Verifica credenciales WiFi
- Usa un broker público sin autenticación primero
- Revisa el Serial Monitor para códigos de error
- Asegúrate de estar en red 2.4 GHz

### Dashboard no recibe datos
- Verifica variables de entorno en Supabase
- Usa el mismo broker en ESP32 y dashboard
- Prueba con "Simular Datos" primero
- Revisa la consola del navegador

## 📝 Notas Importantes

⚠️ **Privacidad:** El video de la cámara solo se muestra localmente en el navegador, no se transmite ni almacena en ningún servidor.

⚠️ **Broker público:** Si usas un broker MQTT público, los datos son potencialmente visibles. Para producción, usa un broker privado.

⚠️ **Precisión:** La distancia debe medirse físicamente y configurarse en el código Arduino (por defecto 0.9 m).

## 🎓 Uso Educativo

Este proyecto está diseñado para:
- Laboratorios de física universitarios
- Clases de cinemática
- Aprendizaje de IoT y MQTT
- Integración de hardware y software
- Visualización de datos en tiempo real

## 🤝 Contribuciones

Este es un proyecto educativo. Siéntete libre de:
- Modificar la distancia del experimento
- Cambiar los topics MQTT
- Personalizar el diseño del dashboard
- Agregar nuevos cálculos físicos
- Mejorar la precisión de las mediciones

## 📄 Licencia

Proyecto educativo de código abierto.

---

**Desarrollado para el control y monitoreo de experimentos de física MRU** 🚀📐

¿Preguntas? Revisa la documentación en `/INSTRUCCIONES_ESP32.md` o `/arduino/README.md`
