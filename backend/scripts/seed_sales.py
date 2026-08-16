import os
import sys
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import numpy as np
from psycopg2.extensions import register_adapter, AsIs
register_adapter(np.int64, AsIs)
from dotenv import load_dotenv

# Add parent dir to path so we can import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.db import db

def run_seed():
    csv_path = "../../m5-forecasting-accuracy/sales_train_validation.csv"
    if not os.path.exists(csv_path):
        print(f"Error: Could not find CSV at {csv_path}")
        return

    print(f"Loading {csv_path} into Pandas (this may take a few seconds)...")
    
    # We only need the ID columns and the last 30 days of sales
    cols_to_load = ['item_id', 'store_id'] + [f'd_{i}' for i in range(1884, 1914)]
    
    try:
        df = pd.read_csv(csv_path, usecols=cols_to_load)
    except ValueError as e:
        print(f"Error reading CSV columns: {e}")
        return

    print("Data loaded. Transforming to long format...")
    
    # Melt the dataframe so we have (item_id, store_id, day_index, sales)
    df_melted = df.melt(id_vars=['item_id', 'store_id'], var_name='d', value_name='sales')
    
    # Extract integer day index from 'd_1884' -> 1884
    df_melted['day_index'] = df_melted['d'].str.replace('d_', '').astype(int)
    
    # Prepare tuples for bulk insert
    # Format: (item_id, store_id, day_index, sales)
    records = df_melted[['item_id', 'store_id', 'day_index', 'sales']].to_records(index=False)
    data_to_insert = list(records)

    print(f"Transform complete. Found {len(data_to_insert)} records to insert.")
    print("Connecting to database and clearing old records...")

    connection = db.connect_db()
    if not connection:
        print("Failed to connect to database.")
        return

    cursor = connection.cursor()

    try:
        # Clear existing table to avoid duplicates if run multiple times
        cursor.execute("TRUNCATE TABLE historical_sales RESTART IDENTITY;")
        
        insert_query = """
            INSERT INTO historical_sales (item_id, store_id, day_index, sales) 
            VALUES %s
        """
        
        print("Starting bulk insert... this might take 10-30 seconds.")
        # execute_values is dramatically faster than individual inserts
        execute_values(cursor, insert_query, data_to_insert, page_size=10000)
        
        connection.commit()
        print("Successfully seeded historical_sales table!")
        
    except psycopg2.Error as e:
        print(f"Database error during seed: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    run_seed()
