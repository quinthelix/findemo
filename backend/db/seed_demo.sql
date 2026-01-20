-- Demo seed data for Findemo - FOR AUTOMATED TESTING ONLY
-- Includes full test data for demo user and demo company

-- =============================================================================
-- 1. COMMODITIES (Required system data)
-- =============================================================================

INSERT INTO commodities (id, name, unit)
VALUES 
    ('cccccccc-1111-cccc-cccc-cccccccccccc', 'sugar', 'lbs'),
    ('cccccccc-2222-cccc-cccc-cccccccccccc', 'flour', 'lbs')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. DEMO CUSTOMER (For testing only)
-- =============================================================================

INSERT INTO customers (id, name, is_demo)
VALUES 
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'demo', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. DEMO USER (For testing only)
-- =============================================================================

-- User: demo / demo123
INSERT INTO users (id, username, password_hash, customer_id)
VALUES (
    'dddddddd-1111-dddd-dddd-dddddddddddd',
    'demo',
    '$2b$12$LpA5dANbpvecyGItCFm98uCbLDR1Ff/jKK/c5GLkanW6BWRdbByOy',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. DEMO PURCHASES (Test data)
-- =============================================================================

-- Sugar purchases
INSERT INTO purchases (id, customer_id, commodity_id, purchase_date, delivery_start_date, delivery_end_date, quantity, unit, purchase_price)
VALUES
    ('eeeeeeee-0001-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-01-15', '2026-02-01', '2026-02-28', 100000, 'lbs', 0.45),
    ('eeeeeeee-0002-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-01-20', '2026-03-01', '2026-03-31', 150000, 'lbs', 0.46),
    ('eeeeeeee-0003-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-02-01', '2026-04-01', '2026-04-30', 200000, 'lbs', 0.47),
    ('eeeeeeee-0004-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-02-10', '2026-05-01', '2026-05-31', 180000, 'lbs', 0.48),
    ('eeeeeeee-0005-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-02-15', '2026-06-01', '2026-06-30', 160000, 'lbs', 0.49),
    ('eeeeeeee-0006-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-03-01', '2026-07-01', '2026-07-31', 140000, 'lbs', 0.50),
    ('eeeeeeee-0007-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2025-03-10', '2026-08-01', '2026-08-31', 120000, 'lbs', 0.51);

-- Flour purchases
INSERT INTO purchases (id, customer_id, commodity_id, purchase_date, delivery_start_date, delivery_end_date, quantity, unit, purchase_price)
VALUES
    ('eeeeeeee-0008-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-01-15', '2026-02-01', '2026-02-28', 80000, 'lbs', 0.35),
    ('eeeeeeee-0009-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-01-20', '2026-03-01', '2026-03-31', 90000, 'lbs', 0.36),
    ('eeeeeeee-0010-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-02-01', '2026-04-01', '2026-04-30', 100000, 'lbs', 0.37),
    ('eeeeeeee-0011-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-02-10', '2026-05-01', '2026-05-31', 95000, 'lbs', 0.38),
    ('eeeeeeee-0012-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-02-15', '2026-06-01', '2026-06-30', 85000, 'lbs', 0.39),
    ('eeeeeeee-0013-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-03-01', '2026-07-01', '2026-07-31', 75000, 'lbs', 0.40),
    ('eeeeeeee-0014-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2025-03-10', '2026-08-01', '2026-08-31', 70000, 'lbs', 0.41);

-- =============================================================================
-- 5. DEMO INVENTORY (Test data)
-- =============================================================================

INSERT INTO inventory_snapshots (id, customer_id, commodity_id, date, quantity)
VALUES
    ('ffffffff-0001-ffff-ffff-ffffffffffff', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-1111-cccc-cccc-cccccccccccc', '2026-01-01', 50000),
    ('ffffffff-0002-ffff-ffff-ffffffffffff', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-2222-cccc-cccc-cccccccccccc', '2026-01-01', 30000);

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- Demo Customer: demo
-- Demo User: demo / demo123
-- Purchases: 14 records (7 sugar, 7 flour)
-- Inventory: 2 records
-- 
-- This data is for automated testing and demonstration purposes only.
-- Use seed_minimal.sql for production/real customer setup.
