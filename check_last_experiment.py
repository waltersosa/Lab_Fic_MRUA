from pymongo import MongoClient
from datetime import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client['mru']

# Obtener último experimento
latest = db['history'].find_one(sort=[('fecha', -1)])

if latest:
    print("=" * 60)
    print("ULTIMO EXPERIMENTO EN MONGODB")
    print("=" * 60)
    print(f"ID: {latest.get('id', latest.get('_id'))}")
    print(f"Fecha: {latest.get('fecha')}")
    print(f"\n--- DATOS PRINCIPALES ---")
    print(f"Tiempo total: {latest.get('tiempo')} s")
    print(f"Distancia: {latest.get('distancia')} m")
    print(f"Velocidad promedio: {latest.get('velocidad')} m/s")
    print(f"Aceleracion: {latest.get('aceleracion')} m/s²")
    print(f"\n--- VELOCIDADES INTERMEDIAS ---")
    print(f"v12: {latest.get('v12')} m/s")
    print(f"v23: {latest.get('v23')} m/s")
    print(f"v34: {latest.get('v34')} m/s")
    print(f"\n--- TIEMPOS INTERMEDIOS ---")
    print(f"t12: {latest.get('t12')} s")
    print(f"t23: {latest.get('t23')} s")
    print(f"t34: {latest.get('t34')} s")
    
    print("\n" + "=" * 60)
    print("COMPARACION CON INTERFAZ")
    print("=" * 60)
    print("Interfaz muestra:")
    print("  - Tiempo Total: 2.24 s")
    print("  - Velocidad Promedio: 0.67 m/s")
    print("  - Aceleracion: 0.55 m/s²")
    print("\nMongoDB tiene:")
    print(f"  - Tiempo Total: {latest.get('tiempo')} s")
    print(f"  - Velocidad Promedio: {latest.get('velocidad')} m/s")
    print(f"  - Aceleracion: {latest.get('aceleracion')} m/s²")
    
    # Verificar si coinciden
    tiempo_match = abs(latest.get('tiempo', 0) - 2.24) < 0.01
    velocidad_match = abs(latest.get('velocidad', 0) - 0.67) < 0.01
    aceleracion_match = abs(latest.get('aceleracion', 0) - 0.55) < 0.01
    
    print("\n" + "=" * 60)
    print("VERIFICACION")
    print("=" * 60)
    print(f"Tiempo: {'[OK] COINCIDE' if tiempo_match else '[X] NO COINCIDE'}")
    print(f"Velocidad: {'[OK] COINCIDE' if velocidad_match else '[X] NO COINCIDE'}")
    print(f"Aceleracion: {'[OK] COINCIDE' if aceleracion_match else '[X] NO COINCIDE'}")
    
    # Verificar datos en coleccion latest
    print("\n" + "=" * 60)
    print("DATOS EN COLECCION 'latest'")
    print("=" * 60)
    latest_doc = db['latest'].find_one({'_id': 'latest'})
    if latest_doc and 'data' in latest_doc:
        data = latest_doc['data']
        print(f"Tiempo: {data.get('tiempo')} s")
        print(f"Velocidad: {data.get('velocidad')} m/s")
        print(f"Aceleracion: {data.get('aceleracion')} m/s²")
        print(f"Status: {latest_doc.get('status')}")
    
    # Buscar experimento que coincida con los datos de latest
    print("\n" + "=" * 60)
    print("BUSCANDO EXPERIMENTO QUE COINCIDA CON 'latest'")
    print("=" * 60)
    matching_exp = db['history'].find_one({
        'tiempo': {'$gte': 2.2, '$lte': 2.3},
        'velocidad': {'$gte': 0.66, '$lte': 0.68},
        'aceleracion': {'$gte': 0.54, '$lte': 0.56}
    }, sort=[('fecha', -1)])
    
    if matching_exp:
        print("[OK] Se encontro experimento que coincide:")
        print(f"  ID: {matching_exp.get('id', matching_exp.get('_id'))}")
        print(f"  Fecha: {matching_exp.get('fecha')}")
        print(f"  Tiempo: {matching_exp.get('tiempo')} s")
        print(f"  Velocidad: {matching_exp.get('velocidad')} m/s")
        print(f"  Aceleracion: {matching_exp.get('aceleracion')} m/s²")
    else:
        print("[X] NO se encontro experimento en 'history' que coincida con 'latest'")
        print("    Esto significa que el experimento actual NO se guardo en 'history'")
        print("    o se guardo con valores diferentes.")
        
        # Mostrar los ultimos 3 experimentos
        print("\n--- Ultimos 3 experimentos en 'history' ---")
        recent = list(db['history'].find().sort('fecha', -1).limit(3))
        for i, exp in enumerate(recent, 1):
            print(f"\n{i}. ID: {exp.get('id', exp.get('_id'))}")
            print(f"   Fecha: {exp.get('fecha')}")
            print(f"   Tiempo: {exp.get('tiempo')} s")
            print(f"   Velocidad: {exp.get('velocidad')} m/s")
            print(f"   Aceleracion: {exp.get('aceleracion')} m/s²")
else:
    print("No se encontraron experimentos")
