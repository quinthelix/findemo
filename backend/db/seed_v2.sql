-- Commodity Hedging & VaR Demo - Multi-Tenant Seed Data
-- Demo customer with full sample data

-- Insert demo customer
INSERT INTO customers (id, name, is_demo) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'demo', true)
ON CONFLICT (name) DO NOTHING;

-- Insert demo user (password: demo123)
-- Password hash generated with bcrypt for "demo123"
INSERT INTO users (id, customer_id, username, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'demo', '$2b$12$LpA5dANbpvecyGItCFm98uCbLDR1Ff/jKK/c5GLkanW6BWRdbByOy')
ON CONFLICT (customer_id, username) DO NOTHING;

-- Insert commodities (global, not customer-specific)
INSERT INTO commodities (id, name, unit) VALUES
    ('11111111-1111-1111-1111-111111111111', 'sugar', 'kg'),
    ('22222222-2222-2222-2222-222222222222', 'flour', 'kg')
ON CONFLICT (name) DO NOTHING;

-- Insert historical purchases for DEMO customer
INSERT INTO purchases (customer_id, commodity_id, purchase_date, delivery_start_date, delivery_end_date, quantity, unit, purchase_price) VALUES
    -- Sugar purchases
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-07-15', '2025-08-01', '2025-10-31', 50000, 'kg', 0.45),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-08-20', '2025-09-01', '2025-11-30', 60000, 'kg', 0.48),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-09-10', '2025-10-01', '2025-12-31', 55000, 'kg', 0.46),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-10-05', '2025-11-01', '2026-01-31', 70000, 'kg', 0.50),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-11-12', '2025-12-01', '2026-02-28', 65000, 'kg', 0.49),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2025-12-01', '2026-01-01', '2026-03-31', 75000, 'kg', 0.51),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2026-01-10', '2026-02-01', '2026-04-30', 80000, 'kg', 0.52),
    -- Flour purchases
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-07-20', '2025-08-01', '2025-10-31', 40000, 'kg', 0.35),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-08-25', '2025-09-01', '2025-11-30', 45000, 'kg', 0.37),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-09-15', '2025-10-01', '2025-12-31', 42000, 'kg', 0.36),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-10-10', '2025-11-01', '2026-01-31', 50000, 'kg', 0.38),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-11-18', '2025-12-01', '2026-02-28', 48000, 'kg', 0.37),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2025-12-05', '2026-01-01', '2026-03-31', 55000, 'kg', 0.39),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2026-01-15', '2026-02-01', '2026-04-30', 60000, 'kg', 0.40)
ON CONFLICT DO NOTHING;

-- Insert inventory snapshots for DEMO customer
INSERT INTO inventory_snapshots (customer_id, date, commodity_id, quantity) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-01-20', '11111111-1111-1111-1111-111111111111', 15000),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-01-20', '22222222-2222-2222-2222-222222222222', 12000)
ON CONFLICT DO NOTHING;

-- Insert sample historical market prices (shared across all customers)
-- Sugar prices (approximate historical spot prices)
INSERT INTO market_prices (commodity_id, price_date, contract_month, price, source) VALUES
    ('11111111-1111-1111-1111-111111111111', '2025-07-01', NULL, 0.44, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2025-08-01', NULL, 0.46, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2025-09-01', NULL, 0.45, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2025-10-01', NULL, 0.48, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2025-11-01', NULL, 0.50, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2025-12-01', NULL, 0.49, 'yahoo_finance'),
    ('11111111-1111-1111-1111-111111111111', '2026-01-01', NULL, 0.51, 'yahoo_finance'),
    -- Flour prices
    ('22222222-2222-2222-2222-222222222222', '2025-07-01', NULL, 0.34, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2025-08-01', NULL, 0.36, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2025-09-01', NULL, 0.35, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2025-10-01', NULL, 0.37, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2025-11-01', NULL, 0.38, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2025-12-01', NULL, 0.37, 'yahoo_finance'),
    ('22222222-2222-2222-2222-222222222222', '2026-01-01', NULL, 0.39, 'yahoo_finance'),
    -- Sample forward curve prices (1M, 3M, 6M, 12M)
    -- Sugar futures
    ('11111111-1111-1111-1111-111111111111', '2026-01-20', '2026-02-01', 0.52, 'futures'),
    ('11111111-1111-1111-1111-111111111111', '2026-01-20', '2026-04-01', 0.53, 'futures'),
    ('11111111-1111-1111-1111-111111111111', '2026-01-20', '2026-07-01', 0.55, 'futures'),
    ('11111111-1111-1111-1111-111111111111', '2026-01-20', '2027-01-01', 0.58, 'futures'),
    -- Flour futures
    ('22222222-2222-2222-2222-222222222222', '2026-01-20', '2026-02-01', 0.40, 'futures'),
    ('22222222-2222-2222-2222-222222222222', '2026-01-20', '2026-04-01', 0.41, 'futures'),
    ('22222222-2222-2222-2222-222222222222', '2026-01-20', '2026-07-01', 0.42, 'futures'),
    ('22222222-2222-2222-2222-222222222222', '2026-01-20', '2027-01-01', 0.44, 'futures')
ON CONFLICT DO NOTHING;
