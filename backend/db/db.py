import logging
from contextlib import contextmanager
from psycopg2 import pool, Error
from psycopg2.extras import RealDictCursor

from config import settings

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    _pool = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._pool is None:
            self._init_pool()
    
    def _init_pool(self):
        try:
            self._pool = pool.ThreadedConnectionPool(
                minconn=settings.DB_POOL_MIN,
                maxconn=settings.DB_POOL_MAX,
                dsn=settings.DATABASE_URL,
                cursor_factory=RealDictCursor
            )
            logger.info("Database connection pool initialized")
        except Error as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        conn = None
        try:
            conn = self._pool.getconn()
            yield conn
        except Error as e:
            logger.error(f"Database error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                self._pool.putconn(conn)
    
    def execute_query(self, query: str, params=None, fetch=False, fetch_one=False):
        """Executes a query. If fetch=True, returns all rows. If fetch_one=True, returns single row."""
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    cursor.execute(query, params)
                    conn.commit()
                    if fetch_one:
                        return cursor.fetchone()
                    if fetch:
                        return cursor.fetchall()
                    return True
                except Error as e:
                    conn.rollback()
                    logger.error(f"Query execution error: {e}")
                    raise
    
    def close_pool(self):
        if self._pool:
            self._pool.closeall()
            logger.info("Database connection pool closed")

db = Database()

def init_db():
    logger.info("Initializing Database Tables...")
    
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
    
    # 4. Historical Sales Data Table
    create_historical_sales_table = """
    CREATE TABLE IF NOT EXISTS historical_sales (
        id SERIAL PRIMARY KEY,
        item_id VARCHAR(100) NOT NULL,
        store_id VARCHAR(50) NOT NULL,
        day_index INTEGER NOT NULL,
        sales INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hist_sales_item_store ON historical_sales(item_id, store_id);
    CREATE INDEX IF NOT EXISTS idx_hist_sales_day ON historical_sales(day_index);
    """
    
    db.execute_query(create_users_table)
    db.execute_query(create_models_table)
    db.execute_query(create_predictions_table)
    db.execute_query(create_historical_sales_table)
    
    # Optional: Insert our default LightGBM model so it exists in the database
    insert_default_model = """
    INSERT INTO models (name, model_type, file_path, is_active) 
    SELECT 'LightGBM Base', 'lightgbm', %s, true 
    WHERE NOT EXISTS (SELECT 1 FROM models WHERE file_path = %s);
    """
    db.execute_query(insert_default_model, (settings.MODEL_PATH, settings.MODEL_PATH))
    
    logger.info("Tables ready.")