-- Commodity Hedging & VaR Demo - Multi-Tenant Database Schema
-- PostgreSQL 15 - Version 2 with customer isolation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: customers
-- Top-level tenant entity
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_name ON customers(name);

-- Table: users
-- Users belong to a customer
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, username)
);

CREATE INDEX idx_users_customer ON users(customer_id);
CREATE INDEX idx_users_username ON users(username);

-- Table: commodities
-- Still global (sugar, flour are universal)
CREATE TABLE IF NOT EXISTS commodities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commodities_name ON commodities(name);

-- Table: purchases
-- Customer-specific historic procurement data
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    delivery_start_date DATE NOT NULL,
    delivery_end_date DATE NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    purchase_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_delivery_dates CHECK (delivery_end_date >= delivery_start_date),
    CONSTRAINT check_quantity_positive CHECK (quantity > 0),
    CONSTRAINT check_price_positive CHECK (purchase_price > 0)
);

CREATE INDEX idx_purchases_customer ON purchases(customer_id);
CREATE INDEX idx_purchases_commodity_id ON purchases(commodity_id);
CREATE INDEX idx_purchases_dates ON purchases(delivery_start_date, delivery_end_date);

-- Table: inventory_snapshots
-- Customer-specific inventory levels
CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_inventory_quantity_positive CHECK (quantity >= 0)
);

CREATE INDEX idx_inventory_snapshots_customer ON inventory_snapshots(customer_id);
CREATE INDEX idx_inventory_snapshots_commodity_date ON inventory_snapshots(commodity_id, date);

-- Table: market_prices
-- Shared across all customers (market data is universal)
CREATE TABLE IF NOT EXISTS market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    price_date DATE NOT NULL,
    contract_month DATE,
    price DECIMAL(15, 2) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_market_price_positive CHECK (price > 0)
);

CREATE INDEX idx_market_prices_commodity_date ON market_prices(commodity_id, price_date);
CREATE INDEX idx_market_prices_contract_month ON market_prices(commodity_id, contract_month);

-- Table: exposure_buckets
-- Customer-specific monthly exposure (derived)
CREATE TABLE IF NOT EXISTS exposure_buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    bucket_month DATE NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    source_purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exposure_buckets_customer ON exposure_buckets(customer_id);
CREATE INDEX idx_exposure_buckets_commodity_month ON exposure_buckets(commodity_id, bucket_month);
CREATE INDEX idx_exposure_buckets_source ON exposure_buckets(source_purchase_id);

-- Table: hedge_sessions
-- Customer-specific active decision session (shopping cart)
CREATE TABLE IF NOT EXISTS hedge_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'executed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hedge_sessions_customer ON hedge_sessions(customer_id);
CREATE INDEX idx_hedge_sessions_user_status ON hedge_sessions(user_id, status);

-- Table: hedge_session_items
-- User-selected futures (not yet executed)
CREATE TABLE IF NOT EXISTS hedge_session_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hedge_session_id UUID NOT NULL REFERENCES hedge_sessions(id) ON DELETE CASCADE,
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    contract_month DATE NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    price_snapshot DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_hedge_item_quantity_positive CHECK (quantity > 0),
    CONSTRAINT check_hedge_item_price_positive CHECK (price_snapshot > 0)
);

CREATE INDEX idx_hedge_session_items_session ON hedge_session_items(hedge_session_id);
CREATE INDEX idx_hedge_session_items_commodity ON hedge_session_items(commodity_id, contract_month);

-- Table: executed_hedges
-- Customer-specific persisted after execution
CREATE TABLE IF NOT EXISTS executed_hedges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    contract_month DATE NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    execution_price DECIMAL(15, 2) NOT NULL,
    execution_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    hedge_session_id UUID REFERENCES hedge_sessions(id),
    CONSTRAINT check_executed_hedge_quantity_positive CHECK (quantity > 0),
    CONSTRAINT check_executed_hedge_price_positive CHECK (execution_price > 0)
);

CREATE INDEX idx_executed_hedges_customer ON executed_hedges(customer_id);
CREATE INDEX idx_executed_hedges_commodity_month ON executed_hedges(commodity_id, contract_month);
CREATE INDEX idx_executed_hedges_date ON executed_hedges(execution_date);

-- Trigger to update hedge_sessions.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hedge_sessions_updated_at
    BEFORE UPDATE ON hedge_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
