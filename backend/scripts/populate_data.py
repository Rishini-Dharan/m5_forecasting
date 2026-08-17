import sys
import os
import random

# Add the parent directory to the path so we can import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.db import db

def populate_historical_sales():
    print("Populating historical_sales table...")
    
    # First, clear existing data
    db.execute_query("TRUNCATE TABLE historical_sales RESTART IDENTITY")
    
    items = ["HOBBIES_1_001", "HOBBIES_1_002", "FOODS_1_001", "FOODS_2_001", "HOUSEHOLD_1_001"]
    stores = ["CA_1", "CA_2", "TX_1"]
    
    # 90 days of history
    num_days = 90
    
    # Pre-calculate a global trend and weekend effects
    # Base volume ranges
    item_base_vol = {
        "HOBBIES_1_001": 50,
        "HOBBIES_1_002": 30,
        "FOODS_1_001": 200,
        "FOODS_2_001": 150,
        "HOUSEHOLD_1_001": 80
    }
    
    store_multiplier = {
        "CA_1": 1.2,
        "CA_2": 1.0,
        "TX_1": 0.8
    }

    insert_query = "INSERT INTO historical_sales (item_id, store_id, day_index, sales) VALUES (%s, %s, %s, %s)"
    
    total_inserted = 0
    
    for item in items:
        for store in stores:
            for day in range(1, num_days + 1):
                # Base volume
                vol = item_base_vol[item] * store_multiplier[store]
                
                # Weekend effect (every 7 days)
                if day % 7 in [0, 6]:
                    vol *= 1.3
                    
                # Seasonal trend (slight upward trend)
                vol += (day * 0.5)
                
                # Random noise
                noise = random.uniform(-0.1, 0.1) * vol
                vol += noise
                
                # Inject occasional anomalies (approx 2-3 per month globally)
                if random.random() < 0.01:
                    if random.random() > 0.5:
                        vol *= 2.5 # Huge spike
                    else:
                        vol *= 0.2 # Huge drop
                
                sales = max(0, int(round(vol)))
                
                db.execute_query(insert_query, (item, store, day, sales))
                total_inserted += 1

    print(f"Successfully inserted {total_inserted} rows of synthetic sales data!")

if __name__ == "__main__":
    populate_historical_sales()
