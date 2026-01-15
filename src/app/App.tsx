import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Activity, 
  Timer, 
  Ruler, 
  Gauge, 
  Calculator,
  Clock,
  Trash2,
  AlertCircle,
  Video
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Supabase se eliminó; API_BASE apunta al bridge local o remoto
import { CameraStream } from './components/CameraStream';

interface ExperimentData {
  tiempo: number;
  distancia: number;
  velocidad: number;
  aceleracion?: number;
  v12?: number;
  v23?: number;
  v34?: number;
  t12?: number;  // tiempo acumulado al sensor 2
  t23?: number;  // tiempo acumulado al sensor 3
  t34?: number;  // tiempo acumulado al sensor 4 (=tiempo total)
  distanciaCalculada?: number;
  timestamp?: number;
}

interface Measurement {
  id: number;
  fecha: string;
  tiempo: number;
  distancia: number;
  velocidad: number;
  aceleracion?: number;
  v12?: number;
  v23?: number;
  v34?: number;
}

type ExperimentStatus = 'Listo' | 'Ejecutando' | 'Finalizado';

export default function App() {
  const [status, setStatus] = useState<ExperimentStatus>('Listo');
  const [data, setData] = useState<ExperimentData>({ tiempo: 0, distancia: 0, velocidad: 0, aceleracion: 0, distanciaCalculada: 0 });
  const [chartData, setChartData] = useState<ExperimentData[]>([]);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<'baja' | 'alta'>('baja');

  // Backend MQTT bridge (sin Supabase). Configurable con VITE_API_BASE.
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:3001/make-server-761e42e2";

  // Fetch experiment status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/experiment-status`);
      const result = await response.json();
      if (result.status) {
        setStatus(result.status);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  // Fetch experiment data
  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE}/experiment-data`);
      const result = await response.json();
      
      // Solo procesar datos válidos (>0) y con timestamp nuevo
      if (result.tiempo !== undefined && result.tiempo > 0 && result.distancia > 0) {
        const hasNewData = result.timestamp !== data.timestamp;

        if (!hasNewData) return;

        const distanciaCalculada = result.velocidad * result.tiempo;
        setData({ ...result, distanciaCalculada });

        // Para MRUA, graficamos los 3 puntos de velocidad en sus tiempos intermedios
        if (result.t12 && result.t23 && result.t34 && result.v12 && result.v23 && result.v34) {
          setChartData([
            { tiempo: result.t12, velocidad: result.v12, distancia: 0.5 },
            { tiempo: result.t23, velocidad: result.v23, distancia: 1.0 },
            { tiempo: result.t34, velocidad: result.v34, distancia: 1.5 }
          ]);
        } else {
          // Fallback para MRU simple
          setChartData([
            { tiempo: 0, distancia: 0, velocidad: 0, distanciaCalculada: 0 },
            { ...result, distanciaCalculada }
          ]);
        }

        if (status === 'Ejecutando') {
          await autoSaveMeasurement(result);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // Auto-save measurement when data arrives from ESP32
  const autoSaveMeasurement = async (measurementData: ExperimentData) => {
    try {
      await fetch(`${API_BASE}/save-measurement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiempo: measurementData.tiempo,
          distancia: measurementData.distancia,
          velocidad: measurementData.velocidad,
          aceleracion: measurementData.aceleracion,
          v12: measurementData.v12,
          v23: measurementData.v23,
          v34: measurementData.v34
        })
      });
      
      console.log('Measurement auto-saved to history');
      fetchHistory();
    } catch (err) {
      console.error('Error auto-saving measurement:', err);
    }
  };

  // Fetch measurement history
  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      const result = await response.json();
      if (result.history) {
        setHistory(result.history);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // Start experiment
  const startExperiment = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/start-experiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMode })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus('Ejecutando');
        setChartData([]);
        setData({ tiempo: 0, distancia: 0, velocidad: 0, aceleracion: 0, distanciaCalculada: 0 });
      } else {
        setError(result.error || 'Error al iniciar experimento');
      }
    } catch (err) {
      console.error('Error starting experiment:', err);
      setError('Error de conexión al iniciar experimento');
    } finally {
      setIsLoading(false);
    }
  };

  // Finalize experiment and save to history
  const finalizeExperiment = async () => {
    if (data.tiempo > 0 || data.distancia > 0) {
      try {
        await fetch(`${API_BASE}/save-measurement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        await fetch(`${API_BASE}/experiment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Finalizado' })
        });
        
        setStatus('Listo');
        setChartData([]);
        setData({ tiempo: 0, distancia: 0, velocidad: 0, aceleracion: 0, distanciaCalculada: 0 });
        fetchHistory();
      } catch (err) {
        console.error('Error finalizing experiment:', err);
      }
    }
  };

  // Clear history
  const clearHistory = async () => {
    try {
      await fetch(`${API_BASE}/history`, {
        method: 'DELETE'
      });
      setHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  // Simulate data for testing (remove in production)
  const simulateData = async () => {
    const tiempo = 1 + Math.random() * 5;
    const distancia = 1.5;
    const velocidad = distancia / tiempo;
    const aceleracion = (Math.random() * 2) - 1; // -1 a 1 m/s^2
    const v12 = velocidad * (0.8 + Math.random() * 0.4);
    const v23 = velocidad * (0.9 + Math.random() * 0.2);
    const v34 = velocidad * (1.0 + Math.random() * 0.2);

    try {
      await fetch(`${API_BASE}/simulate-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiempo, distancia, velocidad, aceleracion, v12, v23, v34 })
      });
    } catch (err) {
      console.error('Error simulating data:', err);
    }
  };

  // Poll for data updates
  useEffect(() => {
    fetchStatus();
    fetchHistory();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchData();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate MRUA
  const calculateMRUA = () => {
    const { tiempo, distancia, velocidad, aceleracion } = data;
    if (tiempo === 0) return null;
    const velocidadCalculada = distancia / tiempo;
    return {
      formula: 'MRUA: d = v₀·t + ½·a·t²',
      substitucion: `a = ${(aceleracion ?? 0).toFixed(3)} m/s²`,
      resultado: `v_prom = ${velocidadCalculada.toFixed(3)} m/s`,
      velocidadMedida: velocidad.toFixed(3)
    };
  };

  const mruaCalculation = calculateMRUA();

  // Status colors
  const getStatusColor = (status: ExperimentStatus) => {
    switch (status) {
      case 'Listo': return 'bg-blue-500';
      case 'Ejecutando': return 'bg-green-500 animate-pulse';
      case 'Finalizado': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Control de Experimento MRUA
              </h1>
              <p className="text-gray-600 mt-1">
                Movimiento Rectilíneo Uniformemente Acelerado - Laboratorio de Física
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                Verifica la configuración del broker MQTT en las variables de entorno.
              </p>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Panel de Control
          </h2>
          
          <div className="flex items-center gap-6 flex-wrap">
            <button
              onClick={startExperiment}
              disabled={isLoading || status !== 'Listo'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-md"
            >
              <Play className="w-5 h-5" />
              {isLoading ? 'Iniciando...' : 'Iniciar Experimento'}
            </button>

            <button
              onClick={finalizeExperiment}
              disabled={status !== 'Ejecutando'}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-md"
            >
              Finalizar Experimento
            </button>

            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-medium">Velocidad:</span>
              <select
                value={speedMode}
                onChange={(e) => setSpeedMode(e.target.value as 'baja' | 'alta')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={status === 'Ejecutando'}
              >
                <option value="baja">Baja (210)</option>
                <option value="alta">Alta (250)</option>
              </select>
            </div>

            {/* Test button - remove in production */}
            <button
              onClick={simulateData}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors text-sm"
            >
              Simular Datos (Test)
            </button>

            <div className="flex items-center gap-3 ml-auto">
              <span className="text-gray-700 font-medium">Estado:</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                <span className="font-bold text-gray-900">{status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Tiempo */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-600 font-semibold">Tiempo Total</h3>
              <Timer className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-4xl font-bold text-gray-900">
              {data.tiempo.toFixed(2)}
            </div>
            <div className="text-gray-500 text-sm mt-1">segundos (s)</div>
          </div>

          {/* Velocidad Promedio */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-600 font-semibold">Velocidad Promedio</h3>
              <Gauge className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-4xl font-bold text-gray-900">
              {data.velocidad.toFixed(2)}
            </div>
            <div className="text-gray-500 text-sm mt-1">m/s</div>
          </div>

          {/* Aceleración */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-red-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-600 font-semibold">Aceleración</h3>
              <Activity className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-4xl font-bold text-gray-900">
              {(data.aceleracion ?? 0).toFixed(2)}
            </div>
            <div className="text-gray-500 text-sm mt-1">m/s²</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Camera Stream */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 h-full flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Video className="w-5 h-5" />
              Monitoreo en Vivo
            </h2>
            
            <div className="aspect-video">
              <CameraStream isActive={status === 'Ejecutando'} />
            </div>
            
            <div className="mt-4 text-gray-600 text-sm">
              Cámara para monitorear el experimento en tiempo real.
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Velocidad vs Tiempo (MRUA)
              </h2>
            </div>
            
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="tiempo" 
                  label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }}
                  stroke="#6b7280"
                />
                <YAxis 
                  label={{ value: 'Velocidad (m/s)', angle: -90, position: 'insideLeft' }}
                  stroke="#6b7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="velocidad" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', r: 6 }}
                  name="Velocidad (m/s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* MRUA Calculation */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Cálculo del MRUA
            </h2>
            
            {mruaCalculation ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-gray-700 font-medium mb-1">Fórmula:</p>
                  <p className="text-2xl font-bold text-blue-700 font-mono">
                    {mruaCalculation.formula}
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-gray-700 font-medium mb-1">Aceleración:</p>
                  <p className="text-3xl font-bold text-red-700">
                    {mruaCalculation.substitucion}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-gray-700 font-medium mb-1">Velocidad Promedio:</p>
                  <p className="text-3xl font-bold text-green-700">
                    {mruaCalculation.resultado}
                  </p>
                </div>

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Nota:</strong> En MRUA la velocidad aumenta linealmente. Las velocidades v₁₂, v₂₃, v₃₄ deben mostrar aceleración.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inicia el experimento para ver los cálculos</p>
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Historial de Mediciones
            </h2>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar Historial
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Fecha / Hora</th>
                    <th className="text-right py-3 px-4 text-gray-700 font-semibold">Tiempo (s)</th>
                    <th className="text-right py-3 px-4 text-gray-700 font-semibold">Velocidad (m/s)</th>
                    <th className="text-right py-3 px-4 text-gray-700 font-semibold">Aceleración (m/s²)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((measurement, index) => (
                    <tr 
                      key={measurement.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index === 0 ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-gray-800">
                        {new Date(measurement.fecha).toLocaleString('es-ES')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {measurement.tiempo.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {measurement.velocidad.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {(measurement.aceleracion ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay mediciones guardadas aún</p>
              <p className="text-sm mt-1">Completa un experimento para ver el historial</p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-bold text-blue-900 mb-2">Instrucciones de Uso</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
            <li>Configura las variables de entorno MQTT (MQTT_BROKER_URL, MQTT_USERNAME, MQTT_PASSWORD)</li>
            <li>Haz clic en "Iniciar Experimento" para enviar el comando MQTT al sistema físico</li>
            <li>Los datos (tiempo, distancia, velocidad) se recibirán automáticamente vía MQTT</li>
            <li>Observa la gráfica y los cálculos en tiempo real</li>
            <li>Haz clic en "Finalizar Experimento" para guardar la medición en el historial</li>
            <li>El botón "Simular Datos" genera datos de prueba sin hardware físico</li>
          </ol>
        </div>
      </main>
    </div>
  );
}