"""
Script para ELIMINAR los datos sintéticos/generados de la base de datos.
Elimina documentos donde 'is_simulated' es True o el ID comienza con 'sim_'.
"""

import pymongo

# Configuración
MONGODB_URI = "mongodb://localhost:27017/"
DATABASE_NAME = "mru"
COLLECTION_NAME = "history"

def main():
    try:
        client = pymongo.MongoClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        # Filtro para identificar datos simulados
        query = {
            "$or": [
                {"is_simulated": True},
                {"id": {"$regex": "^sim_"}}
            ]
        }
        
        # Contar antes de borrar
        count = collection.count_documents(query)
        
        if count == 0:
            print("[INFO] No se encontraron datos sintéticos para borrar.")
            return

        print(f"[INFO] Se encontraron {count} experimentos simulados.")
        
        import sys
        if "--force" in sys.argv:
            confirm = 's'
        else:
            confirm = input("¿Estás seguro de que quieres borrarlos permanentemente? (s/n): ")
        
        if confirm.lower() == 's':
            result = collection.delete_many(query)
            print(f"[OK] Eliminados {result.deleted_count} documentos.")
        else:
            print("[INFO] Operación cancelada.")
            
    except Exception as e:
        print(f"[ERROR] Ocurrió un error: {e}")

if __name__ == "__main__":
    main()
