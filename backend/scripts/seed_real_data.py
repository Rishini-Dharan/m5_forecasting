import sys
import os
import pandas as pd
import psycopg2.extras
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.db import db

def seed_real_data():
    print("Reading Kaggle dataset...")
    start_time = time.time()
    
    # Path relative to scripts folder
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "m5-forecasting-accuracy", "sales_train_evaluation.csv")
    
    if not os.path.exists(csv_path):
        print(f"Error: Could not find {csv_path}")
        return

    # Read base columns + last 30 days (d_1912 to d_1941)
    base_cols = ["item_id", "store_id"]
    day_cols = [f"d_{i}" for i in range(1912, 1942)]
    use_cols = base_cols + day_cols
    
    df = pd.read_csv(csv_path, usecols=use_cols)
    print(f"Loaded CSV in {time.time() - start_time:.2f} seconds.")
    
    print("Melting data...")
    melt_start = time.time()
    df_melted = pd.melt(df, id_vars=base_cols, var_name="day_str", value_name="sales")
    
    # Convert 'd_1852' to integer 1852
    df_melted['day_index'] = df_melted['day_str'].str.replace('d_', '').astype(int)
    
    # Drop the string column and reorder
    df_final = df_melted[['item_id', 'store_id', 'day_index', 'sales']]
    print(f"Melted to {len(df_final)} rows in {time.time() - melt_start:.2f} seconds.")
    
    print("Clearing historical_sales table...")
    db.execute_query("TRUNCATE TABLE historical_sales RESTART IDENTITY;")
    
    print("Bulk inserting to PostgreSQL...")
    insert_start = time.time()
    
    # Convert dataframe to list of tuples for execute_values
    data_tuples = list(df_final.itertuples(index=False, name=None))
    
    conn = db.connect_db()
    cursor = conn.cursor()
    
    insert_query = "INSERT INTO historical_sales (item_id, store_id, day_index, sales) VALUES %s"
    psycopg2.extras.execute_values(cursor, insert_query, data_tuples, page_size=10000)
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Successfully inserted {len(df_final)} rows in {time.time() - insert_start:.2f} seconds!")

if __name__ == "__main__":
    seed_real_data()
