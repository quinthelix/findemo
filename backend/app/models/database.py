"""
SQLAlchemy ORM models - Multi-tenant
Maps to PostgreSQL schema with customer isolation
"""
from sqlalchemy import Column, String, DateTime, Date, Numeric, ForeignKey, CheckConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    users = relationship("User", back_populates="customer")
    purchases = relationship("Purchase", back_populates="customer")
    inventory_snapshots = relationship("InventorySnapshot", back_populates="customer")
    exposure_buckets = relationship("ExposureBucket", back_populates="customer")
    hedge_sessions = relationship("HedgeSession", back_populates="customer")
    executed_hedges = relationship("ExecutedHedge", back_populates="customer")


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(50), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer", back_populates="users")
    hedge_sessions = relationship("HedgeSession", back_populates="user")


class Commodity(Base):
    __tablename__ = "commodities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False, index=True)
    unit = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    purchases = relationship("Purchase", back_populates="commodity")
    market_prices = relationship("MarketPrice", back_populates="commodity")
    exposure_buckets = relationship("ExposureBucket", back_populates="commodity")
    hedge_session_items = relationship("HedgeSessionItem", back_populates="commodity")
    executed_hedges = relationship("ExecutedHedge", back_populates="commodity")


class Purchase(Base):
    __tablename__ = "purchases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    purchase_date = Column(Date, nullable=False)
    delivery_start_date = Column(Date, nullable=False)
    delivery_end_date = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    unit = Column(String(20), nullable=False)
    purchase_price = Column(Numeric(15, 2), nullable=False)
    price_type = Column(String(10), default='fixed')  # 'fixed' or 'floating'
    payment_date = Column(Date, nullable=True)  # When price is locked/paid
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("delivery_end_date >= delivery_start_date", name="check_delivery_dates"),
        CheckConstraint("quantity > 0", name="check_quantity_positive"),
        CheckConstraint("purchase_price > 0", name="check_price_positive"),
    )
    
    customer = relationship("Customer", back_populates="purchases")
    commodity = relationship("Commodity", back_populates="purchases")
    exposure_buckets = relationship("ExposureBucket", back_populates="source_purchase")


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="check_inventory_quantity_positive"),
    )
    
    customer = relationship("Customer", back_populates="inventory_snapshots")


class MarketPrice(Base):
    __tablename__ = "market_prices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    price_date = Column(Date, nullable=False)
    contract_month = Column(Date, nullable=True)
    price = Column(Numeric(15, 2), nullable=False)
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("price > 0", name="check_market_price_positive"),
    )
    
    commodity = relationship("Commodity", back_populates="market_prices")


class ExposureBucket(Base):
    __tablename__ = "exposure_buckets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    bucket_month = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    source_purchase_id = Column(UUID(as_uuid=True), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    customer = relationship("Customer", back_populates="exposure_buckets")
    commodity = relationship("Commodity", back_populates="exposure_buckets")
    source_purchase = relationship("Purchase", back_populates="exposure_buckets")


class HedgeSession(Base):
    __tablename__ = "hedge_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("status IN ('active', 'executed', 'cancelled')", name="check_status"),
    )
    
    customer = relationship("Customer", back_populates="hedge_sessions")
    user = relationship("User", back_populates="hedge_sessions")
    items = relationship("HedgeSessionItem", back_populates="hedge_session", cascade="all, delete-orphan")


class HedgeSessionItem(Base):
    __tablename__ = "hedge_session_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hedge_session_id = Column(UUID(as_uuid=True), ForeignKey("hedge_sessions.id", ondelete="CASCADE"), nullable=False)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    contract_month = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    price_snapshot = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_hedge_item_quantity_positive"),
        CheckConstraint("price_snapshot > 0", name="check_hedge_item_price_positive"),
    )
    
    hedge_session = relationship("HedgeSession", back_populates="items")
    commodity = relationship("Commodity", back_populates="hedge_session_items")


class ExecutedHedge(Base):
    __tablename__ = "executed_hedges"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    commodity_id = Column(UUID(as_uuid=True), ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    contract_month = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    execution_price = Column(Numeric(15, 2), nullable=False)
    execution_date = Column(DateTime(timezone=True), server_default=func.now())
    hedge_session_id = Column(UUID(as_uuid=True), ForeignKey("hedge_sessions.id"), nullable=True)
    
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_executed_hedge_quantity_positive"),
        CheckConstraint("execution_price > 0", name="check_executed_hedge_price_positive"),
    )
    
    customer = relationship("Customer", back_populates="executed_hedges")
    commodity = relationship("Commodity", back_populates="executed_hedges")
