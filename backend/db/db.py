import logging
from contextlib import contextmanager

from psycopg2 import Error, pool
from psycopg2.extras import RealDictCursor

from config import settings

logger = logging.getLogger(__name__)


class Database:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pool = None
        return cls._instance

    def _ensure_pool(self):
        """Create the pool on first use, so importing this module never needs a live database."""
        if self._pool is not None:
            return
        try:
            self._pool = pool.ThreadedConnectionPool(
                minconn=settings.DB_POOL_MIN,
                maxconn=settings.DB_POOL_MAX,
                dsn=settings.DATABASE_URL,
                cursor_factory=RealDictCursor,
            )
            logger.info("Database connection pool initialized")
        except Error as exc:
            logger.error("Failed to initialize connection pool: %s", exc)
            raise

    @contextmanager
    def get_connection(self):
        self._ensure_pool()
        conn = None
        try:
            conn = self._pool.getconn()
            yield conn
        except Error:
            if conn is not None:
                # Roll back before returning the connection, or the next borrower inherits a
                # poisoned transaction and every subsequent query fails.
                try:
                    conn.rollback()
                except Error:
                    logger.warning("Rollback failed; discarding connection", exc_info=True)
                    self._pool.putconn(conn, close=True)
                    conn = None
            raise
        finally:
            if conn is not None:
                self._pool.putconn(conn)

    def execute_query(self, query: str, params=None, fetch=False, fetch_one=False):
        """Execute a query. fetch=True returns all rows, fetch_one=True returns a single row."""
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    cursor.execute(query, params)
                    if fetch_one:
                        result = cursor.fetchone()
                    elif fetch:
                        result = cursor.fetchall()
                    else:
                        result = True
                    conn.commit()
                    return result
                except Error:
                    conn.rollback()
                    logger.error("Query execution error", exc_info=True)
                    raise

    def close_pool(self):
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None
            logger.info("Database connection pool closed")


db = Database()


def init_db():
    logger.info("Initializing database tables...")

    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            store_id VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            item_id VARCHAR(100) NOT NULL,
            store_id VARCHAR(50) NOT NULL,
            features_json JSONB,
            predicted_value FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS historical_sales (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(100) NOT NULL,
            store_id VARCHAR(50) NOT NULL,
            day_index INTEGER NOT NULL,
            sales INTEGER NOT NULL
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_hist_sales_item_store ON historical_sales(item_id, store_id);",
        "CREATE INDEX IF NOT EXISTS idx_hist_sales_day ON historical_sales(day_index);",
        "CREATE INDEX IF NOT EXISTS idx_hist_sales_store ON historical_sales(store_id);",
    ]

    for statement in statements:
        db.execute_query(statement)

    logger.info("Tables ready.")
