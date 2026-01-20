-- Minimal seed data for Findemo
-- Only includes: commodities, customer, and user
-- No demo purchases or inventory - user will upload their own Excel files

-- =============================================================================
-- 1. COMMODITIES (REQUIRED - System needs these defined)
-- =============================================================================

INSERT INTO commodities (id, name, unit)
VALUES 
    ('cccccccc-1111-cccc-cccc-cccccccccccc', 'sugar', 'lbs'),
    ('cccccccc-2222-cccc-cccc-cccccccccccc', 'flour', 'lbs')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. CUSTOMERS (Separate companies for multi-tenant testing)
-- =============================================================================

-- Customer 1: Demo Company (for automated tests with seeded data)
INSERT INTO customers (id, name, is_demo)
VALUES 
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'demo', true)
ON CONFLICT DO NOTHING;

-- Customer 2: Hedgymunchy (real customer for Excel uploads)
INSERT INTO customers (id, name, is_demo)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hedgymunchy', false)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. USERS (Login credentials - each belongs to different customer)
-- =============================================================================

-- User 1: demo / demo123 → Demo Company
-- Password: demo123
-- Generated with: bcrypt.hashpw(b'demo123', bcrypt.gensalt())
INSERT INTO users (id, username, password_hash, customer_id)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'demo',
    '$2b$12$LpA5dANbpvecyGItCFm98uCbLDR1Ff/jKK/c5GLkanW6BWRdbByOy',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'  -- Demo Company
)
ON CONFLICT DO NOTHING;

-- User 2: avi / avi123 → Hedgymunchy
-- Password: avi123
-- Generated with: bcrypt.hashpw(b'avi123', bcrypt.gensalt())
INSERT INTO users (id, username, password_hash, customer_id)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'avi',
    '$2b$12$xdzy6PJ8lWakgkMfflFcXe243U8SRdfZsUejYMDdRTHuwR0U5nCgS',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'  -- Hedgymunchy
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- Two separate customers for multi-tenant testing:
--
-- DEMO COMPANY (for automated tests):
--   Username: demo
--   Password: demo123
--   Company:  demo
--   Purpose:  Automated tests with seed_demo.sql data
--
-- HEDGYMUNCHY (real customer):
--   Username: avi
--   Password: avi123
--   Company:  hedgymunchy
--   Purpose:  Real data testing via Excel uploads

-- Next step: Upload your Excel files via the Data Upload page
