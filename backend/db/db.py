from dotenv import load_dotenv
import psycopg2
from psycopg2 import Error
import os

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")

class Database:
    def __init__(self, DB_URL):
        self.DB_URL = DB_URL
    
    def connect_db(self):
        try:
            connection = psycopg2.connect(self.DB_URL)
            return connection
        except Error as e:
            print(f"Error connecting: {e}")
            return None
            
    def execute_query(self, query, params=None, fetch=False):
        """Executes a query. If fetch=True, returns the fetched rows."""
        connection = self.connect_db()
        if connection is None:
            return None
            
        cursor = connection.cursor()
        try:
            cursor.execute(query, params)
            connection.commit()
            if fetch:
                return cursor.fetchall()
            return True
        except Error as e:
            print(f"Error executing query: {e}")
            connection.rollback()
            return None
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

db = Database(DB_URL)

def init_db():
    print("Initializing Database Tables...")
    
    # 1. Users Table
    create_users_table = """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, 
        store_id VARCHAR(50), 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    # 2. Models Table
    create_models_table = """
    CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        model_type VARCHAR(50) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    # 3. Predictions Tracking Table
    create_predictions_table = """
    CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        model_id INTEGER REFERENCES models(id) ON DELETE SET NULL,
        item_id VARCHAR(100) NOT NULL,
        store_id VARCHAR(50) NOT NULL,
        features_json JSONB,
        predicted_value FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    # 4. Voice Conversation Memory Table
    create_voice_conversations_table = """
    CREATE TABLE IF NOT EXISTS voice_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    # 5. Historical Sales Data Table
    create_historical_sales_table = """
    CREATE TABLE IF NOT EXISTS historical_sales (
        id SERIAL PRIMARY KEY,
        item_id VARCHAR(100) NOT NULL,
        store_id VARCHAR(50) NOT NULL,
        day_index INTEGER NOT NULL,
        sales INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hist_sales_item_store ON historical_sales(item_id, store_id);
    """

    db.execute_query(create_users_table)
    db.execute_query(create_models_table)
    db.execute_query(create_predictions_table)
    db.execute_query(create_voice_conversations_table)
    db.execute_query(create_historical_sales_table)
    
    # Optional: Insert our default LightGBM model so it exists in the database
    insert_default_model = """
    INSERT INTO models (name, model_type, file_path, is_active) 
    SELECT 'LightGBM Base', 'lightgbm', 'models/lgb_model.txt', true 
    WHERE NOT EXISTS (SELECT 1 FROM models WHERE file_path = 'models/lgb_model.txt');
    """
    db.execute_query(insert_default_model)

    print("Tables ready.")