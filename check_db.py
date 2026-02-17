import pymongo

try:
    client = pymongo.MongoClient("mongodb://localhost:27017/")
    db = client["mru"]
    collection = db["history"]
    count = collection.count_documents({})
    print(f"Total documents in 'history': {count}")
    
    # Check for simulated data
    simulated = collection.count_documents({"is_simulated": True})
    print(f"Simulated documents: {simulated}")
    
    # Check modes
    remote = collection.count_documents({"mode": "remote"})
    presential = collection.count_documents({"mode": "presential"})
    print(f"Remote: {remote}, Presential: {presential}")

    # Inspect the first simulated document if exists
    if simulated > 0:
        print("Sample simulated doc:", collection.find_one({"is_simulated": True}))

except Exception as e:
    print(f"Error: {e}")
