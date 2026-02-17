"""
Script de análisis de experimentos MRUA (Movimiento Rectilíneo Uniformemente Acelerado)
Extrae datos de MongoDB, calcula estadísticas y genera visualizaciones comparativas
entre modalidad remota y presencial.
"""

import pymongo
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
from typing import Dict, List, Tuple
import warnings
import os
warnings.filterwarnings('ignore')


# ============ CONFIGURACIÓN MONGODB ============
MONGODB_URI = "mongodb://localhost:27017/"  # Ajustar según tu configuración
DATABASE_NAME = "mru"  # Base de datos real donde se guardan los datos
COLLECTION_NAME = "history"  # Colección real donde se guardan los experimentos
RAW_DATA_COLLECTION = "raw_experiments"  # Colección para datos crudos procesados
# Distancia entre sensores (en metros) - debe coincidir con el Arduino
DISTANCE_BETWEEN_SENSORS = 0.50  # 50 cm entre cada sensor

# ============ CONFIGURACIÓN DE RUTAS ============
import os
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "analysis_output")  # Carpeta en raíz del proyecto


# ============ CONEXIÓN A MONGODB ============
def connect_to_mongodb(uri: str, database: str) -> pymongo.database.Database:
    """
    Establece conexión con MongoDB y retorna la base de datos.
    
    Args:
        uri: URI de conexión a MongoDB
        database: Nombre de la base de datos
        
    Returns:
        Objeto Database de pymongo
    """
    try:
        client = pymongo.MongoClient(uri)
        db = client[database]
        # Verificar conexión
        client.admin.command('ping')
        print(f"[OK] Conectado a MongoDB: {database}")
        return db
    except Exception as e:
        print(f"[ERROR] Error conectando a MongoDB: {e}")
        raise


# ============ EXTRACCIÓN DE DATOS ============
def extract_experiments(db: pymongo.database.Database, collection: str) -> pd.DataFrame:
    """
    Extrae todos los experimentos de la colección y los convierte a DataFrame.
    Adaptado para el formato real: {tiempo, distancia, velocidad, aceleracion, v12, v23, v34, t12, t23, t34}
    
    Args:
        db: Objeto Database de MongoDB
        collection: Nombre de la colección
        
    Returns:
        DataFrame con los experimentos expandidos en formato de sensores
    """
    collection_obj = db[collection]
    experiments = list(collection_obj.find().sort('fecha', -1))  # Más recientes primero
    
    if len(experiments) == 0:
        print("[WARNING] No se encontraron experimentos en la coleccion")
        return pd.DataFrame(), []
    
    # Convertir formato real a formato de sensores
    rows = []
    for i, exp in enumerate(experiments):
        exp_id = exp.get('id', exp.get('_id', f'exp_{i}'))
        # Asumir modo 'remote' por defecto (puedes agregar campo 'mode' si lo necesitas)
        mode = exp.get('mode', 'remote')
        # Extraer campo 'failed' (true si fue finalizado manualmente o tiempo > 3s)
        failed = exp.get('failed', False)
        fecha_str = exp.get('fecha')
        if fecha_str:
            try:
                if isinstance(fecha_str, str):
                    timestamp = pd.to_datetime(fecha_str)
                else:
                    timestamp = fecha_str
            except:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()
        
        # Extraer tiempos y velocidades
        t12 = exp.get('t12', 0)
        t23 = exp.get('t23', 0)
        t34 = exp.get('t34', 0)
        tiempo_total = exp.get('tiempo', t34 if t34 > 0 else 0)
        
        # Reconstruir datos de sensores basado en tiempos intermedios
        # Sensor 1 (inicio): tiempo = 0, distancia = 0
        if tiempo_total > 0 or t34 > 0:
            rows.append({
                'experiment_id': str(exp_id),
                'mode': mode,
                'failed': failed,
                'timestamp': timestamp,
                'sensor_id': 1,
                'distance_cm': 0.0,
                'time_s': 0.0
            })
            
            # Sensor 2: tiempo = t12, distancia = 50cm
            if t12 > 0:
                rows.append({
                    'experiment_id': str(exp_id),
                    'mode': mode,
                    'failed': failed,
                    'timestamp': timestamp,
                    'sensor_id': 2,
                    'distance_cm': DISTANCE_BETWEEN_SENSORS * 100,  # 50 cm
                    'time_s': t12
                })
            
            # Sensor 3: tiempo = t23, distancia = 100cm
            if t23 > 0:
                rows.append({
                    'experiment_id': str(exp_id),
                    'mode': mode,
                    'failed': failed,
                    'timestamp': timestamp,
                    'sensor_id': 3,
                    'distance_cm': DISTANCE_BETWEEN_SENSORS * 2 * 100,  # 100 cm
                    'time_s': t23
                })
            
            # Sensor 4 (final): tiempo = t34 (o tiempo_total), distancia = 150cm
            final_time = t34 if t34 > 0 else tiempo_total
            if final_time > 0:
                rows.append({
                    'experiment_id': str(exp_id),
                    'mode': mode,
                    'failed': failed,
                    'timestamp': timestamp,
                    'sensor_id': 4,
                    'distance_cm': DISTANCE_BETWEEN_SENSORS * 3 * 100,  # 150 cm
                    'time_s': final_time
                })
    
    df = pd.DataFrame(rows)
    
    # Normalizar timestamps para evitar error de comparación (tz-naive vs tz-aware)
    if not df.empty and 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True).dt.tz_localize(None)

    print(f"[OK] Extraidos {len(experiments)} experimentos ({len(df)} registros de sensores)")
    if len(df) > 0:
        print(f"   Rango de fechas: {df['timestamp'].min()} a {df['timestamp'].max()}")
    
    return df, experiments


# ============ CÁLCULOS ESTADÍSTICOS ============
def calculate_statistics(df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    """
    Calcula estadísticas por sensor y modalidad.
    
    Args:
        df: DataFrame con los datos de experimentos
        
    Returns:
        Diccionario con DataFrames de estadísticas
    """
    # Agrupar por sensor_id y mode
    grouped = df.groupby(['sensor_id', 'mode'])['time_s'].agg([
        'mean', 'std', 'count'
    ]).reset_index()
    grouped.columns = ['sensor_id', 'mode', 'time_mean', 'time_std', 'count']
    
    # Separar remoto y presencial
    remote = grouped[grouped['mode'] == 'remote'].copy()
    presential = grouped[grouped['mode'] == 'presential'].copy()
    
    # Merge para calcular error relativo
    merged = pd.merge(
        remote[['sensor_id', 'time_mean', 'time_std']],
        presential[['sensor_id', 'time_mean', 'time_std']],
        on='sensor_id',
        suffixes=('_remote', '_presential'),
        how='outer'
    )
    
    # Calcular error relativo porcentual
    merged['error_relativo_pct'] = (
        (merged['time_mean_remote'] - merged['time_mean_presential']) / 
        merged['time_mean_presential'] * 100
    )
    merged['error_relativo_pct'] = merged['error_relativo_pct'].fillna(0)
    
    return {
        'grouped': grouped,
        'remote': remote,
        'presential': presential,
        'comparison': merged
    }


# ============ ESTADÍSTICAS DE FALLOS ============
def calculate_failure_statistics(df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    """
    Calcula estadísticas de experimentos fallidos separados por modalidad.
    
    Args:
        df: DataFrame con los datos de experimentos (debe incluir columna 'failed')
        
    Returns:
        Diccionario con DataFrames de estadísticas de fallos
    """
    if 'failed' not in df.columns:
        print("[WARNING] Columna 'failed' no encontrada en DataFrame")
        return {}
    
    # Obtener experimentos únicos con su estado de fallo
    experiments = df.groupby(['experiment_id', 'mode', 'failed']).size().reset_index(name='count')
    
    # Contar fallos por modalidad
    failure_counts = experiments.groupby(['mode', 'failed']).size().reset_index(name='count')
    
    # Separar por modalidad
    remote_failures = failure_counts[failure_counts['mode'] == 'remote'].copy()
    presential_failures = failure_counts[failure_counts['mode'] == 'presential'].copy()
    
    # Calcular porcentajes
    remote_total = remote_failures['count'].sum() if not remote_failures.empty else 0
    presential_total = presential_failures['count'].sum() if not presential_failures.empty else 0
    
    if remote_total > 0:
        remote_failures['percentage'] = (remote_failures['count'] / remote_total * 100).round(2)
    else:
        remote_failures['percentage'] = 0
    
    if presential_total > 0:
        presential_failures['percentage'] = (presential_failures['count'] / presential_total * 100).round(2)
    else:
        presential_failures['percentage'] = 0
    
    # Resumen consolidado
    summary = pd.DataFrame({
        'mode': ['remote', 'presential'],
        'total_experiments': [remote_total, presential_total],
        'failed_count': [
            remote_failures[remote_failures['failed'] == True]['count'].sum() if not remote_failures.empty else 0,
            presential_failures[presential_failures['failed'] == True]['count'].sum() if not presential_failures.empty else 0
        ],
        'success_count': [
            remote_failures[remote_failures['failed'] == False]['count'].sum() if not remote_failures.empty else 0,
            presential_failures[presential_failures['failed'] == False]['count'].sum() if not presential_failures.empty else 0
        ]
    })
    
    if summary['total_experiments'].sum() > 0:
        summary['failure_rate_pct'] = (summary['failed_count'] / summary['total_experiments'] * 100).round(2)
    else:
        summary['failure_rate_pct'] = 0
    
    return {
        'summary': summary,
        'remote': remote_failures,
        'presential': presential_failures,
        'all': failure_counts
    }


# ============ CÁLCULO DE VELOCIDAD Y ACELERACIÓN ============
def calculate_velocity_and_acceleration(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula velocidad promedio entre sensores y aceleración promedio.
    
    Args:
        df: DataFrame con datos de experimentos
        
    Returns:
        DataFrame con velocidades y aceleraciones calculadas
    """
    results = []
    
    # Agrupar por experimento
    for exp_id in df['experiment_id'].unique():
        exp_data = df[df['experiment_id'] == exp_id].sort_values('sensor_id')
        mode = exp_data['mode'].iloc[0]
        
        if len(exp_data) < 2:
            continue
        
        # Calcular velocidades entre sensores consecutivos
        velocities = []
        accelerations = []
        
        for i in range(len(exp_data) - 1):
            sensor_curr = exp_data.iloc[i]
            sensor_next = exp_data.iloc[i + 1]
            
            # Distancia en metros
            distance_m = (sensor_next['distance_cm'] - sensor_curr['distance_cm']) / 100.0
            time_interval = sensor_next['time_s'] - sensor_curr['time_s']
            
            if time_interval > 0:
                velocity = distance_m / time_interval
                velocities.append({
                    'experiment_id': exp_id,
                    'mode': mode,
                    'sensor_from': sensor_curr['sensor_id'],
                    'sensor_to': sensor_next['sensor_id'],
                    'position_cm': sensor_next['distance_cm'],
                    'velocity_ms': velocity,
                    'time_interval_s': time_interval
                })
        
        # Calcular aceleración entre intervalos consecutivos
        # Para MRUA: a = (v2 - v1) / t, donde t es el tiempo del intervalo donde cambia la velocidad
        accel_values = []
        if len(velocities) >= 2:
            for j in range(len(velocities) - 1):
                v1 = velocities[j]['velocity_ms']
                v2 = velocities[j + 1]['velocity_ms']
                # El tiempo del intervalo donde ocurre el cambio de velocidad
                # es el tiempo del intervalo siguiente (donde se mide v2)
                t_acc = velocities[j + 1]['time_interval_s']
                
                if t_acc > 0:
                    accel = (v2 - v1) / t_acc
                    accel_values.append(accel)
                    accelerations.append({
                        'experiment_id': exp_id,
                        'mode': mode,
                        'sensor_from': velocities[j]['sensor_to'],
                        'sensor_to': velocities[j + 1]['sensor_to'],
                        'acceleration_ms2': accel
                    })
        
        # Agregar aceleración promedio del experimento completo
        if len(accel_values) > 0:
            accel_mean = sum(accel_values) / len(accel_values)
            accelerations.append({
                'experiment_id': exp_id,
                'mode': mode,
                'sensor_from': None,
                'sensor_to': None,
                'acceleration_ms2': accel_mean
            })
        
        results.extend(velocities)
        results.extend(accelerations)
    
    return pd.DataFrame(results)


# ============ GUARDAR DATOS CRUDOS EN MONGODB ============
def save_raw_data_to_mongodb(db: pymongo.database.Database, df: pd.DataFrame, original_experiments: List):
    """
    Guarda los datos crudos procesados en una colección separada de MongoDB.
    
    Args:
        db: Objeto Database de MongoDB
        df: DataFrame con datos procesados
        original_experiments: Lista de experimentos originales
    """
    try:
        col_raw = db[RAW_DATA_COLLECTION]
        
        # Convertir DataFrame a documentos
        raw_docs = []
        for exp_id in df['experiment_id'].unique():
            exp_data = df[df['experiment_id'] == exp_id]
            sensors_data = []
            
            for _, row in exp_data.iterrows():
                sensors_data.append({
                    'sensor_id': int(row['sensor_id']),
                    'distance_cm': float(row['distance_cm']),
                    'time_s': float(row['time_s'])
                })
            
            # Buscar experimento original para datos adicionales
            original_exp = next((e for e in original_experiments if str(e.get('id', e.get('_id'))) == exp_id), None)
            
            raw_doc = {
                'experiment_id': exp_id,
                'mode': exp_data['mode'].iloc[0] if len(exp_data) > 0 else 'remote',
                'timestamp': exp_data['timestamp'].iloc[0] if len(exp_data) > 0 else datetime.now(),
                'sensors': sensors_data,
                'processed_at': datetime.now(),
                # Datos originales adicionales
                'original_data': {
                    'tiempo': original_exp.get('tiempo') if original_exp else None,
                    'distancia': original_exp.get('distancia') if original_exp else None,
                    'velocidad': original_exp.get('velocidad') if original_exp else None,
                    'aceleracion': original_exp.get('aceleracion') if original_exp else None,
                    'v12': original_exp.get('v12') if original_exp else None,
                    'v23': original_exp.get('v23') if original_exp else None,
                    'v34': original_exp.get('v34') if original_exp else None,
                    't12': original_exp.get('t12') if original_exp else None,
                    't23': original_exp.get('t23') if original_exp else None,
                    't34': original_exp.get('t34') if original_exp else None,
                }
            }
            raw_docs.append(raw_doc)
        
        # Insertar o actualizar (upsert por experiment_id)
        for doc in raw_docs:
            col_raw.update_one(
                {'experiment_id': doc['experiment_id']},
                {'$set': doc},
                upsert=True
            )
        
        print(f"[OK] Datos crudos guardados en coleccion '{RAW_DATA_COLLECTION}' ({len(raw_docs)} experimentos)")
    except Exception as e:
        print(f"[WARNING] Error guardando datos crudos: {e}")


# ============ EXPORTAR A CSV ============
def export_to_csv(df: pd.DataFrame, stats: Dict[str, pd.DataFrame], output_dir: str, velocities_df: pd.DataFrame = None, accelerations_df: pd.DataFrame = None, failure_stats: Dict[str, pd.DataFrame] = None):
    """
    Exporta todos los datos a archivos CSV en la carpeta especificada.
    
    Args:
        df: DataFrame principal con datos de sensores
        stats: Diccionario con estadísticas
        output_dir: Directorio donde guardar los CSV
        velocities_df: DataFrame con velocidades
        accelerations_df: DataFrame con aceleraciones
        failure_stats: Diccionario con estadísticas de fallos
    """
    try:
        # Crear directorio si no existe
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. Datos crudos de sensores
        csv_path = os.path.join(output_dir, "raw_sensors_data.csv")
        df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        print(f"[OK] Datos crudos exportados: {csv_path}")
        
        # 2. Estadísticas por sensor
        if 'grouped' in stats:
            csv_path = os.path.join(output_dir, "statistics_by_sensor.csv")
            stats['grouped'].to_csv(csv_path, index=False, encoding='utf-8-sig')
            print(f"[OK] Estadisticas exportadas: {csv_path}")
        
        # 3. Comparación remoto vs presencial
        if 'comparison' in stats:
            csv_path = os.path.join(output_dir, "comparison_remote_vs_presential.csv")
            stats['comparison'].to_csv(csv_path, index=False, encoding='utf-8-sig')
            print(f"[OK] Comparacion exportada: {csv_path}")
        
        # 4. Velocidades
        if velocities_df is not None and not velocities_df.empty:
            csv_path = os.path.join(output_dir, "velocities.csv")
            velocities_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            print(f"[OK] Velocidades exportadas: {csv_path}")
        
        # 5. Aceleraciones
        if accelerations_df is not None and not accelerations_df.empty:
            csv_path = os.path.join(output_dir, "accelerations.csv")
            accelerations_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            print(f"[OK] Aceleraciones exportadas: {csv_path}")
        
        # 6. Estadísticas de fallos
        if failure_stats and not failure_stats.get('summary', pd.DataFrame()).empty:
            csv_path = os.path.join(output_dir, "failure_statistics.csv")
            failure_stats['summary'].to_csv(csv_path, index=False, encoding='utf-8-sig')
            print(f"[OK] Estadisticas de fallos exportadas: {csv_path}")
            
            # Exportar detalles por modalidad
            if not failure_stats.get('remote', pd.DataFrame()).empty:
                csv_path = os.path.join(output_dir, "failure_statistics_remote.csv")
                failure_stats['remote'].to_csv(csv_path, index=False, encoding='utf-8-sig')
                print(f"[OK] Fallos remotos exportados: {csv_path}")
            
            if not failure_stats.get('presential', pd.DataFrame()).empty:
                csv_path = os.path.join(output_dir, "failure_statistics_presential.csv")
                failure_stats['presential'].to_csv(csv_path, index=False, encoding='utf-8-sig')
                print(f"[OK] Fallos presenciales exportados: {csv_path}")
        
        print(f"[OK] Todos los CSV guardados en: {output_dir}")
    except Exception as e:
        print(f"[ERROR] Error exportando a CSV: {e}")


# ============ GRÁFICAS ============
def plot_time_vs_sensor(stats: Dict[str, pd.DataFrame], output_path: str = None):
    """
    Gráfica: Tiempo de paso vs número de sensor (remoto vs presencial).
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    
    remote = stats['remote']
    presential = stats['presential']
    
    ax.errorbar(
        remote['sensor_id'],
        remote['time_mean'],
        yerr=remote['time_std'],
        marker='o',
        linestyle='--',
        label='Remoto',
        capsize=5,
        capthick=2
    )
    
    ax.errorbar(
        presential['sensor_id'],
        presential['time_mean'],
        yerr=presential['time_std'],
        marker='s',
        linestyle='--',
        label='Presencial',
        capsize=5,
        capthick=2
    )
    
    ax.set_xlabel('Número de Sensor', fontsize=12)
    ax.set_ylabel('Tiempo de Paso (s)', fontsize=12)
    ax.set_title('Tiempo de Paso vs Sensor: Remoto vs Presencial', fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    if output_path:
        # Si es solo el nombre del archivo, usar OUTPUT_DIR
        if not os.path.dirname(output_path):
            output_path = os.path.join(OUTPUT_DIR, output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"[OK] Grafica guardada: {output_path}")
    plt.close()  # Cerrar figura para liberar memoria


def plot_relative_error(stats: Dict[str, pd.DataFrame], output_path: str = None):
    """
    Gráfica: Error relativo (%) por sensor.
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    
    comparison = stats['comparison']
    
    bars = ax.bar(
        comparison['sensor_id'],
        comparison['error_relativo_pct'],
        color=['red' if x < 0 else 'green' for x in comparison['error_relativo_pct']],
        alpha=0.7,
        edgecolor='black',
        linewidth=1.5
    )
    
    ax.axhline(y=0, color='black', linestyle='-', linewidth=1)
    ax.set_xlabel('Número de Sensor', fontsize=12)
    ax.set_ylabel('Error Relativo (%)', fontsize=12)
    ax.set_title('Error Relativo entre Modalidad Remota y Presencial', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='y')
    
    # Anotar valores
    for i, (sensor, error) in enumerate(zip(comparison['sensor_id'], comparison['error_relativo_pct'])):
        ax.text(sensor, error, f'{error:.2f}%', ha='center', va='bottom' if error > 0 else 'top')
    
    plt.tight_layout()
    if output_path:
        # Si es solo el nombre del archivo, usar OUTPUT_DIR
        if not os.path.dirname(output_path):
            output_path = os.path.join(OUTPUT_DIR, output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"[OK] Grafica guardada: {output_path}")
    plt.close()  # Cerrar figura para liberar memoria


def plot_velocity_vs_position(velocities_df: pd.DataFrame, output_path: str = None):
    """
    Gráfica: Velocidad promedio vs posición del sensor.
    """
    if velocities_df.empty:
        print("[WARNING] No hay datos de velocidad para graficar")
        return
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Agrupar por posición y modalidad
    velocity_stats = velocities_df.groupby(['position_cm', 'mode'])['velocity_ms'].mean().reset_index()
    
    remote_vel = velocity_stats[velocity_stats['mode'] == 'remote']
    presential_vel = velocity_stats[velocity_stats['mode'] == 'presential']
    
    ax.plot(
        remote_vel['position_cm'],
        remote_vel['velocity_ms'],
        marker='o',
        linestyle='--',
        label='Remoto',
        linewidth=2,
        markersize=8
    )
    
    ax.plot(
        presential_vel['position_cm'],
        presential_vel['velocity_ms'],
        marker='s',
        linestyle='--',
        label='Presencial',
        linewidth=2,
        markersize=8
    )
    
    ax.set_xlabel('Posición del Sensor (cm)', fontsize=12)
    ax.set_ylabel('Velocidad Promedio (m/s)', fontsize=12)
    ax.set_title('Velocidad Promedio vs Posición del Sensor', fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    if output_path:
        # Si es solo el nombre del archivo, usar OUTPUT_DIR
        if not os.path.dirname(output_path):
            output_path = os.path.join(OUTPUT_DIR, output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"[OK] Grafica guardada: {output_path}")
    plt.close()  # Cerrar figura para liberar memoria


def plot_acceleration_comparison(accelerations_df: pd.DataFrame, output_path: str = None):
    """
    Gráfica: Aceleración promedio del experimento (boxplot).
    """
    if accelerations_df.empty:
        print("[WARNING] No hay datos de aceleracion para graficar")
        return
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Preparar datos para boxplot
    remote_acc = accelerations_df[accelerations_df['mode'] == 'remote']['acceleration_ms2'].dropna()
    presential_acc = accelerations_df[accelerations_df['mode'] == 'presential']['acceleration_ms2'].dropna()
    
    data_to_plot = [remote_acc, presential_acc]
    labels = ['Remoto', 'Presencial']
    
    bp = ax.boxplot(data_to_plot, labels=labels, patch_artist=True, widths=0.6)
    
    # Colorear boxes
    colors = ['lightblue', 'lightgreen']
    for patch, color in zip(bp['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    ax.set_ylabel('Aceleración (m/s²)', fontsize=12)
    ax.set_title('Distribución de Aceleración: Remoto vs Presencial', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='y')
    
    # Agregar estadísticas
    for i, (data, label) in enumerate(zip(data_to_plot, labels)):
        mean_val = data.mean()
        ax.text(i + 1, mean_val, f'μ={mean_val:.3f}', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    if output_path:
        # Si es solo el nombre del archivo, usar OUTPUT_DIR
        if not os.path.dirname(output_path):
            output_path = os.path.join(OUTPUT_DIR, output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"[OK] Grafica guardada: {output_path}")
    plt.close()  # Cerrar figura para liberar memoria


def plot_experimental_vs_theoretical(df: pd.DataFrame, output_path: str = None):
    """
    Gráfica: Comparación experimental vs modelo teórico MRUA.
    Modelo teórico: x(t) = x₀ + v₀t + ½at²
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Agrupar por modalidad
    for mode in df['mode'].unique():
        mode_data = df[df['mode'] == mode].copy()
        
        # Calcular aceleración promedio para el ajuste
        accelerations = []
        for exp_id in mode_data['experiment_id'].unique():
            exp_data = mode_data[mode_data['experiment_id'] == exp_id].sort_values('sensor_id')
            if len(exp_data) >= 2:
                # Ajuste lineal simple: v = at (asumiendo v₀=0)
                times = exp_data['time_s'].values
                distances = exp_data['distance_cm'].values / 100.0  # a metros
                
                if len(times) > 1:
                    # Ajuste polinomial de segundo grado: x = 0.5*a*t²
                    coeffs = np.polyfit(times, distances, 2)
                    a_est = coeffs[0] * 2  # a = 2 * coeficiente de t²
                    accelerations.append(a_est)
        
        if not accelerations:
            continue
        
        a_mean = np.mean(accelerations)
        
        # Generar curva teórica
        t_theoretical = np.linspace(0, mode_data['time_s'].max(), 100)
        x_theoretical = 0.5 * a_mean * t_theoretical ** 2  # x = ½at² (v₀=0, x₀=0)
        
        # Datos experimentales promedio por tiempo
        exp_grouped = mode_data.groupby('time_s')['distance_cm'].mean() / 100.0
        
        ax.plot(
            t_theoretical,
            x_theoretical * 100,  # convertir a cm para comparar
            linestyle='--',
            linewidth=2,
            label=f'{mode.capitalize()} - Teórico (a={a_mean:.3f} m/s²)'
        )
        
        ax.scatter(
            exp_grouped.index,
            exp_grouped.values * 100,
            marker='o' if mode == 'remote' else 's',
            s=100,
            alpha=0.7,
            label=f'{mode.capitalize()} - Experimental',
            edgecolors='black',
            linewidths=1.5
        )
    
    ax.set_xlabel('Tiempo (s)', fontsize=12)
    ax.set_ylabel('Distancia (cm)', fontsize=12)
    ax.set_title('Comparación Experimental vs Modelo Teórico MRUA', fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    if output_path:
        # Si es solo el nombre del archivo, usar OUTPUT_DIR
        if not os.path.dirname(output_path):
            output_path = os.path.join(OUTPUT_DIR, output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"[OK] Grafica guardada: {output_path}")
    plt.close()  # Cerrar figura para liberar memoria


# ============ FUNCIÓN PRINCIPAL ============
def main():
    """
    Función principal que ejecuta todo el pipeline de análisis.
    Organiza los resultados en carpetas por experimento (prueba_1_remoto, prueba_2_remoto, etc.)
    """
    print("=" * 60)
    print("ANÁLISIS DE EXPERIMENTOS MRUA")
    print("=" * 60)
    
    # 1. Conectar a MongoDB
    try:
        db = connect_to_mongodb(MONGODB_URI, DATABASE_NAME)
    except Exception as e:
        print(f"[ERROR] No se pudo conectar a MongoDB: {e}")
        return
    
    # 2. Extraer datos
    df, original_experiments = extract_experiments(db, COLLECTION_NAME)
    if df.empty:
        print("[ERROR] No hay datos para analizar")
        return
    
    # 2.1. Guardar datos crudos en MongoDB
    if len(df) > 0:
        save_raw_data_to_mongodb(db, df, original_experiments)
    
    # Agrupar experimentos por modo y procesar cada uno individualmente
    print("\n[INFO] Organizando experimentos por modo...")
    
    # Contadores para numerar experimentos por modo
    remote_count = {}
    presential_count = {}
    
    # Agrupar por experiment_id y modo
    for exp_id in df['experiment_id'].unique():
        exp_data = df[df['experiment_id'] == exp_id]
        if exp_data.empty:
            continue
            
        mode = exp_data['mode'].iloc[0]
        
        # Determinar número de experimento para este modo
        if mode == 'remote':
            if mode not in remote_count:
                remote_count[mode] = 0
            remote_count[mode] += 1
            exp_num = remote_count[mode]
            folder_name = f"prueba_{exp_num}_remoto"
        else:  # presential
            if mode not in presential_count:
                presential_count[mode] = 0
            presential_count[mode] += 1
            exp_num = presential_count[mode]
            folder_name = f"prueba_{exp_num}_presencial"
        
        # Crear carpeta para este experimento
        exp_output_dir = os.path.join(OUTPUT_DIR, folder_name)
        exp_csv_dir = os.path.join(exp_output_dir, "csv")
        exp_graphs_dir = os.path.join(exp_output_dir, "graphs")
        
        os.makedirs(exp_csv_dir, exist_ok=True)
        os.makedirs(exp_graphs_dir, exist_ok=True)
        
        print(f"\n{'='*60}")
        print(f"Procesando: {folder_name} (ID: {exp_id})")
        print(f"{'='*60}")
        
        # 3. Calcular estadísticas para este experimento
        print("\n[INFO] Calculando estadisticas...")
        stats = calculate_statistics(exp_data)
        
        # 3.1. Calcular estadísticas de fallos
        failure_stats = calculate_failure_statistics(exp_data)
        
        # Mostrar resumen
        print("\n--- Resumen de Tiempos por Sensor ---")
        print(stats['grouped'].to_string(index=False))
        
        print("\n--- Comparación Remoto vs Presencial ---")
        print(stats['comparison'].to_string(index=False))
        
        # Mostrar estadísticas de fallos
        if failure_stats and not failure_stats.get('summary', pd.DataFrame()).empty:
            print("\n--- Estadísticas de Fallos por Modalidad ---")
            print(failure_stats['summary'].to_string(index=False))
        
        # 4. Calcular velocidades y aceleraciones
        print("\n[INFO] Calculando velocidades y aceleraciones...")
        vel_acc_df = calculate_velocity_and_acceleration(exp_data)
        
        velocities_df = pd.DataFrame()
        accelerations_df = pd.DataFrame()
        
        if not vel_acc_df.empty:
            velocities_df = vel_acc_df[vel_acc_df['velocity_ms'].notna()] if 'velocity_ms' in vel_acc_df.columns else pd.DataFrame()
            accelerations_df = vel_acc_df[vel_acc_df['acceleration_ms2'].notna()] if 'acceleration_ms2' in vel_acc_df.columns else pd.DataFrame()
            
            print(f"\n[OK] Calculadas {len(velocities_df)} velocidades y {len(accelerations_df)} aceleraciones")
            
            # Mostrar resumen
            if not velocities_df.empty:
                print("\n--- Velocidades Promedio ---")
                print(velocities_df.groupby(['mode', 'sensor_to'])['velocity_ms'].mean().to_string())
            
            if not accelerations_df.empty:
                print("\n--- Aceleraciones Promedio ---")
                print(accelerations_df.groupby('mode')['acceleration_ms2'].mean().to_string())
        
        # 5. Generar gráficas
        print("\n[INFO] Generando graficas...")
        plot_time_vs_sensor(stats, os.path.join(exp_graphs_dir, 'time_vs_sensor.png'))
        plot_relative_error(stats, os.path.join(exp_graphs_dir, 'relative_error.png'))
        
        if velocities_df is not None and not velocities_df.empty:
            plot_velocity_vs_position(velocities_df, os.path.join(exp_graphs_dir, 'velocity_vs_position.png'))
        
        if accelerations_df is not None and not accelerations_df.empty:
            plot_acceleration_comparison(accelerations_df, os.path.join(exp_graphs_dir, 'acceleration_comparison.png'))
        
        plot_experimental_vs_theoretical(exp_data, os.path.join(exp_graphs_dir, 'experimental_vs_theoretical.png'))
        
        # 6. Exportar a CSV
        print("\n[INFO] Exportando datos a CSV...")
        export_to_csv(exp_data, stats, exp_csv_dir, velocities_df, accelerations_df, failure_stats)
        
        print(f"\n[OK] Analisis de {folder_name} completado!")
        print(f"   - Graficas guardadas en: {exp_graphs_dir}")
        print(f"   - CSV guardados en: {exp_csv_dir}")
    
    print("\n" + "=" * 60)
    print("[OK] Analisis completo de todos los experimentos!")
    print(f"   - Resultados organizados en: {OUTPUT_DIR}")
    print(f"   - Datos crudos guardados en MongoDB: coleccion '{RAW_DATA_COLLECTION}'")
    print("=" * 60)


if __name__ == "__main__":
    main()
