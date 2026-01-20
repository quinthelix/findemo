"""
Database validation tests for Phase 1
Tests schema integrity, seed data, and constraints
"""
import pytest
import psycopg2
import os

# Database connection parameters
# Use 'postgres' hostname when running inside Docker container
# Use 'localhost' when running from host machine
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'postgres'),  # 'postgres' for Docker, 'localhost' for host
    'port': 5432,
    'database': 'findemo_db',
    'user': 'findemo',
    'password': 'findemo_dev_pass'
}

@pytest.fixture(scope="module")
def db_connection():
    """Database connection fixture"""
    conn = psycopg2.connect(**DB_CONFIG)
    yield conn
    conn.close()

def test_connection():
    """Test database connection"""
    conn = psycopg2.connect(**DB_CONFIG)
    assert conn is not None, "Database connection failed"
    conn.close()

def test_tables_exist(db_connection):
    """Verify all required tables exist"""
    expected_tables = [
        'users',
        'customers',
        'commodities',
        'purchases',
        'inventory_snapshots',
        'market_prices',
        'exposure_buckets',
        'hedge_sessions',
        'hedge_session_items',
        'executed_hedges'
    ]
    
    cursor = db_connection.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    
    existing_tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    
    for table in expected_tables:
        assert table in existing_tables, f"Table '{table}' is missing"

def test_seed_data(db_connection):
    """Verify seed data is present"""
    cursor = db_connection.cursor()
    
    tests = [
        ("users", "SELECT COUNT(*) FROM users WHERE username = 'demo'", 1, "Demo user exists"),
        ("commodities", "SELECT COUNT(*) FROM commodities WHERE name IN ('sugar', 'flour')", 2, "Sugar and Flour commodities exist"),
        ("purchases", "SELECT COUNT(*) FROM purchases", 14, "Historical purchases exist (14 expected)"),
        ("inventory_snapshots", "SELECT COUNT(*) FROM inventory_snapshots", 2, "Inventory snapshots exist"),
        ("market_prices", "SELECT COUNT(*) FROM market_prices", 22, "Market prices exist (22 expected)"),
    ]
    
    for table, query, expected_count, description in tests:
        cursor.execute(query)
        count = cursor.fetchone()[0]
        assert count == expected_count, f"{description} - Expected {expected_count}, got {count}"
    
    cursor.close()

def test_foreign_keys(db_connection):
    """Test foreign key constraints"""
    cursor = db_connection.cursor()
    
    # Test that purchases reference valid commodities
    cursor.execute("""
        SELECT COUNT(*) FROM purchases p
        LEFT JOIN commodities c ON p.commodity_id = c.id
        WHERE c.id IS NULL
    """)
    orphaned = cursor.fetchone()[0]
    assert orphaned == 0, f"Found {orphaned} purchases with invalid commodity references"
    
    # Test that market_prices reference valid commodities
    cursor.execute("""
        SELECT COUNT(*) FROM market_prices mp
        LEFT JOIN commodities c ON mp.commodity_id = c.id
        WHERE c.id IS NULL
    """)
    orphaned = cursor.fetchone()[0]
    assert orphaned == 0, f"Found {orphaned} market prices with invalid commodity references"
    
    cursor.close()

def test_indexes(db_connection):
    """Verify important indexes exist"""
    cursor = db_connection.cursor()
    
    expected_indexes = [
        'idx_users_username',
        'idx_customers_name',
        'idx_commodities_name',
        'idx_purchases_commodity_id',
        'idx_market_prices_commodity_date',
        'idx_exposure_buckets_commodity_month',
        'idx_hedge_sessions_user_status',
    ]
    
    cursor.execute("""
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
    """)
    
    existing_indexes = [row[0] for row in cursor.fetchall()]
    cursor.close()
    
    for index in expected_indexes:
        assert index in existing_indexes, f"Index '{index}' is missing"

def test_constraints(db_connection):
    """Test data constraints"""
    cursor = db_connection.cursor()
    
    # Test that quantities are positive
    cursor.execute("SELECT COUNT(*) FROM purchases WHERE quantity <= 0")
    invalid = cursor.fetchone()[0]
    assert invalid == 0, f"Found {invalid} purchases with non-positive quantities"
    
    # Test that prices are positive
    cursor.execute("SELECT COUNT(*) FROM market_prices WHERE price <= 0")
    invalid = cursor.fetchone()[0]
    assert invalid == 0, f"Found {invalid} market prices with non-positive values"
    
    # Test delivery date logic
    cursor.execute("SELECT COUNT(*) FROM purchases WHERE delivery_end_date < delivery_start_date")
    invalid = cursor.fetchone()[0]
    assert invalid == 0, f"Found {invalid} purchases with invalid delivery date ranges"
    
    cursor.close()
