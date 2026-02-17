"""
Script para generar datos simulados de experimentos MRUA directamente en archivos CSV.
Genera 70 experimentos (35 Remotos + 35 Presenciales) con estructura de carpetas compatible.
"""

import os
import shutil
import random
import math
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

# Configuración
BASE_DIR = Path("c:/Dashboard de Control MRU")
OUTPUT_DIR = BASE_DIR / "analysis_output"

NUM_SAMPLES_PER_MODE = 35 # 35 Remote + 35 Presential = 70 Total

def ensure_clean_dir():
    if OUTPUT_DIR.exists():
        # Limpiar directorio para asegurar solo 70 ensayos/carpetas relevantes
        for item in OUTPUT_DIR.iterdir():
            if item.is_dir() and (item.name.startswith("sim_") or item.name.startswith("prueba_")):
                try:
                    shutil.rmtree(item)
                except Exception as e:
                    print(f"Error removing {item}: {e}")
    else:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def generate_experiment_data(mode, index, a_target):
    # Física: x = 0.5 * a * t^2 -> t = sqrt(2x/a)
    # Posiciones: 0, 0.5, 1.0, 1.5 m
    positions_m = [0.0, 0.5, 1.0, 1.5]
    
    # Variación realista de 'a' alrededor del target
    a = a_target + random.gauss(0, 0.05)
    if a < 0.2: a = 0.2
    
    times = []
    for x in positions_m:
        if x == 0:
            t = 0.0
        else:
            t = math.sqrt(2 * x / a)
            # Agregar ruido experimental al tiempo sensor
            # Presencial un poco menos ruidoso que remoto
            noise_std = 0.005 if mode == 'presential' else 0.008 
            t += random.gauss(0, noise_std)
        times.append(t)
    
    # Asegurar monotonicidad temporal (t_i+1 > t_i)
    for i in range(1, len(times)):
        if times[i] <= times[i-1]:
            times[i] = times[i-1] + 0.01

    # Crear DF raw
    raw_rows = []
    timestamp = datetime.now() - timedelta(minutes=random.randint(0, 10000))
    exp_id = f"sim_{mode}_{index}"
    
    for i, (p_m, t) in enumerate(zip(positions_m, times)):
        raw_rows.append({
            'experiment_id': exp_id,
            'mode': mode,
            'failed': False,
            'timestamp': timestamp,
            'sensor_id': i + 1,
            'distance_cm': p_m * 100,
            'time_s': round(t, 4)
        })
        
    df_raw = pd.DataFrame(raw_rows)
    
    # Crear DF accel (promedio)
    df_accel = pd.DataFrame([{
        'experiment_id': exp_id,
        'mode': mode,
        'sensor_from': None,
        'sensor_to': None,
        'acceleration_ms2': round(a, 4)
    }])
    
    return exp_id, df_raw, df_accel

def main():
    print(f"Generando {NUM_SAMPLES_PER_MODE*2} experimentos en {OUTPUT_DIR}...")
    ensure_clean_dir()
    
    # Generar pares para mantener correlaciones "físicas"
    # (Misma física subyacente, diferente ruido/medición)
    
    for i in range(1, NUM_SAMPLES_PER_MODE + 1):
        # Aceleración base para este "par" de ensayos
        # Rango disperso para tener buena nube de puntos
        a_base = random.uniform(0.5, 1.5) 
        
        # 1. Presencial
        exp_id_pre, df_raw_pre, df_accel_pre = generate_experiment_data('presential', i, a_base)
        
        # 2. Remoto (misma a_base, diferente sample)
        exp_id_rem, df_raw_rem, df_accel_rem = generate_experiment_data('remote', i, a_base)
        
        # Guardar archivos
        for exp_id, df_r, df_a in [(exp_id_pre, df_raw_pre, df_accel_pre), (exp_id_rem, df_raw_rem, df_accel_rem)]:
            mode = df_r['mode'].iloc[0]
            suffix = 'remoto' if mode == 'remote' else 'presencial'
            folder_name = f"prueba_{i}_{suffix}"
            folder_path = OUTPUT_DIR / folder_name / "csv"
            
            try:
                folder_path.mkdir(parents=True, exist_ok=True)
                df_r.to_csv(folder_path / "raw_sensors_data.csv", index=False)
                df_a.to_csv(folder_path / "accelerations.csv", index=False)
            except Exception as e:
                print(f"Error saving {folder_path}: {e}")
            
    print("[OK] Generación completa.")

if __name__ == "__main__":
    main()
