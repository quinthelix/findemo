-- Migration script from v1 to v2 (multi-tenant)
-- This script adds customer_id columns and migrates existing data to demo customer

BEGIN;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo customer
INSERT INTO customers (id, name, is_demo) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'demo', true)
ON CONFLICT (name) DO NOTHING;

-- Add customer_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE users SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE users ALTER COLUMN customer_id SET NOT NULL;
DROP INDEX IF EXISTS idx_users_username;
CREATE UNIQUE INDEX idx_users_customer_username ON users(customer_id, username);

-- Add customer_id to purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE purchases SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE purchases ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_customer ON purchases(customer_id);

-- Add customer_id to inventory_snapshots
ALTER TABLE inventory_snapshots ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE inventory_snapshots SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE inventory_snapshots ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_customer ON inventory_snapshots(customer_id);

-- Add customer_id to exposure_buckets
ALTER TABLE exposure_buckets ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE exposure_buckets SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE exposure_buckets ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exposure_buckets_customer ON exposure_buckets(customer_id);

-- Add customer_id to hedge_sessions
ALTER TABLE hedge_sessions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE hedge_sessions SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE hedge_sessions ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hedge_sessions_customer ON hedge_sessions(customer_id);

-- Add customer_id to executed_hedges
ALTER TABLE executed_hedges ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
UPDATE executed_hedges SET customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE customer_id IS NULL;
ALTER TABLE executed_hedges ALTER COLUMN customer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executed_hedges_customer ON executed_hedges(customer_id);

COMMIT;
