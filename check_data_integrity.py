import os
import pandas as pd
from pathlib import Path

BASE_DIR = Path("c:/Dashboard de Control MRU/analysis_output")

def log(msg):
    with open("integrity_log.txt", "a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg)

def check_integrity():
    if os.path.exists("integrity_log.txt"):
        os.remove("integrity_log.txt")
        
    log("Checking data integrity for first 70 experiments...")
    
    missing_accel = []
    empty_accel = []
    valid_count = 0
    total_checked = 0
    
    # Check remote 1-70
    for i in range(1, 72):
        folder_name = f"prueba_{i}_remoto"
        folder_path = BASE_DIR / folder_name
        
        if not folder_path.exists():
            continue
            
        if total_checked >= 70:
            break
            
        csv_path = folder_path / "csv" / "accelerations.csv"
        
        if not csv_path.exists():
            missing_accel.append(folder_name)
        else:
            try:
                df = pd.read_csv(csv_path)
                if df.empty:
                    empty_accel.append(folder_name)
                    log(f"{folder_name}: Empty dataframe")
                else:
                    # Check if avg acceleration exists (sensor_from is empty)
                    avg = df[df['sensor_from'].isna() | df['sensor_from'].isnull()]
                    if avg.empty:
                        empty_accel.append(f"{folder_name} (no average)")
                        log(f"{folder_name}: No average acceleration row")
                    else:
                        valid_count += 1
            except Exception as e:
                log(f"Error reading {folder_name}: {e}")
                
        total_checked += 1
        
    log(f"\nChecked {total_checked} folders.")
    log(f"Valid acceleration data found: {valid_count}")
    
    if missing_accel:
        log("\nMissing accelerations.csv:")
        for f in missing_accel: log(f" - {f}")
        
    if empty_accel:
        log("\nEmpty or invalid accelerations.csv:")
        for f in empty_accel: log(f" - {f}")

if __name__ == "__main__":
    check_integrity()
