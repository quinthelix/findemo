"""
Market data service - Yahoo Finance and Stooq integration
Fetches historical prices and forward curves
"""
import yfinance as yf
import pandas as pd
import pandas_datareader as pdr
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.database import Commodity, MarketPrice
import logging

logger = logging.getLogger(__name__)


# Commodity ticker mappings
COMMODITY_TICKERS = {
    "sugar": {
        "yahoo": "SB=F",  # Sugar Futures
        "stooq": "SB.F"
    },
    "flour": {
        "yahoo": "ZW=F",  # Wheat Futures (proxy for flour)
        "stooq": "ZW.F"
    }
}


async def fetch_historical_prices(
    commodity_name: str,
    start_date: date,
    end_date: date
) -> List[Tuple[date, float]]:
    """
    Fetch historical spot prices from Yahoo Finance
    Returns list of (date, price) tuples
    """
    ticker_info = COMMODITY_TICKERS.get(commodity_name.lower())
    if not ticker_info:
        logger.error(f"Unknown commodity: {commodity_name}")
        return []
    
    try:
        # Try Yahoo Finance first
        ticker = yf.Ticker(ticker_info["yahoo"])
        hist = ticker.history(start=start_date, end=end_date)
        
        if hist.empty:
            logger.warning(f"No data from Yahoo Finance for {commodity_name}, trying Stooq")
            # Fallback to Stooq
            hist = pdr.DataReader(
                ticker_info["stooq"],
                'stooq',
                start_date,
                end_date
            )
        
        if hist.empty:
            logger.warning(f"No historical data available for {commodity_name}")
            return []
        
        # Extract closing prices
        prices = []
        for idx, row in hist.iterrows():
            price_date = idx.date() if hasattr(idx, 'date') else idx
            price = float(row['Close'])
            prices.append((price_date, price))
        
        logger.info(f"Fetched {len(prices)} historical prices for {commodity_name}")
        return prices
        
    except Exception as e:
        logger.error(f"Error fetching historical prices for {commodity_name}: {e}")
        return []


async def fetch_futures_contracts(
    commodity_name: str,
    reference_date: date
) -> List[Tuple[date, float]]:
    """
    Fetch or generate forward curve (1M, 3M, 6M, 12M)
    Returns list of (contract_month, price) tuples
    """
    ticker_info = COMMODITY_TICKERS.get(commodity_name.lower())
    if not ticker_info:
        logger.error(f"Unknown commodity: {commodity_name}")
        return []
    
    try:
        # Get latest spot price
        ticker = yf.Ticker(ticker_info["yahoo"])
        hist = ticker.history(period="5d")
        
        if hist.empty:
            logger.warning(f"Cannot get spot price for {commodity_name}, using Stooq fallback")
            hist = pdr.DataReader(
                ticker_info["stooq"],
                'stooq',
                datetime.now() - timedelta(days=5),
                datetime.now()
            )
        
        if hist.empty:
            logger.error(f"Cannot generate forward curve without spot price for {commodity_name}")
            return []
        
        spot_price = float(hist['Close'].iloc[-1])
        
        # Generate forward curve with contango (prices slightly higher for longer dated contracts)
        # This is a simplified model for demo purposes
        contracts = []
        for months_ahead in [1, 3, 6, 12]:
            contract_date = reference_date + relativedelta(months=months_ahead)
            # First day of the contract month
            contract_month = date(contract_date.year, contract_date.month, 1)
            
            # Simple contango model: add 0.5% per month
            forward_price = spot_price * (1 + 0.005 * months_ahead)
            
            contracts.append((contract_month, forward_price))
        
        logger.info(f"Generated {len(contracts)} futures contracts for {commodity_name}")
        return contracts
        
    except Exception as e:
        logger.error(f"Error generating futures contracts for {commodity_name}: {e}")
        return []


async def refresh_market_data(db: AsyncSession) -> Dict[str, int]:
    """
    Refresh market data for all commodities
    Returns statistics about data refreshed
    """
    stats = {
        "commodities_updated": [],
        "historical_prices_added": 0,
        "futures_contracts_updated": 0
    }
    
    # Get all commodities
    result = await db.execute(select(Commodity))
    commodities = result.scalars().all()
    
    today = date.today()
    historical_start = today - timedelta(days=365)  # Last 12 months
    
    for commodity in commodities:
        commodity_name = commodity.name.lower()
        
        # Fetch historical prices
        historical_prices = await fetch_historical_prices(
            commodity_name,
            historical_start,
            today
        )
        
        if historical_prices:
            # Delete existing historical prices for this commodity
            await db.execute(
                delete(MarketPrice).where(
                    MarketPrice.commodity_id == commodity.id,
                    MarketPrice.contract_month.is_(None)
                )
            )
            
            # Insert new historical prices
            for price_date, price in historical_prices:
                market_price = MarketPrice(
                    commodity_id=commodity.id,
                    price_date=price_date,
                    contract_month=None,
                    price=price,
                    source="yahoo_finance"
                )
                db.add(market_price)
                stats["historical_prices_added"] += 1
        
        # Fetch futures contracts
        futures_contracts = await fetch_futures_contracts(commodity_name, today)
        
        if futures_contracts:
            # Delete existing futures for this commodity from today
            await db.execute(
                delete(MarketPrice).where(
                    MarketPrice.commodity_id == commodity.id,
                    MarketPrice.contract_month.isnot(None),
                    MarketPrice.price_date >= today
                )
            )
            
            # Insert new futures contracts
            for contract_month, price in futures_contracts:
                market_price = MarketPrice(
                    commodity_id=commodity.id,
                    price_date=today,
                    contract_month=contract_month,
                    price=price,
                    source="futures"
                )
                db.add(market_price)
                stats["futures_contracts_updated"] += 1
        
        stats["commodities_updated"].append(commodity.name)
    
    await db.commit()
    
    logger.info(f"Market data refresh complete: {stats}")
    return stats


async def get_available_futures(db: AsyncSession) -> List[Dict]:
    """
    Get all available futures contracts
    """
    result = await db.execute(
        select(MarketPrice, Commodity)
        .join(Commodity)
        .where(MarketPrice.contract_month.isnot(None))
        .order_by(Commodity.name, MarketPrice.contract_month)
    )
    
    futures = []
    for market_price, commodity in result:
        futures.append({
            "commodity": commodity.name,
            "contract_month": market_price.contract_month,
            "price": float(market_price.price),
            "source": market_price.source,
            "price_date": market_price.price_date
        })
    
    return futures
