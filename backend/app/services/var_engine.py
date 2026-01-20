"""
VaR Engine - Parametric (variance-covariance) Value at Risk calculations
Implements exact math from AGENTS.md section 8

Critical formulas:
- Single-commodity VaR per bucket: VaR_{i,t} = Z_α × σ_{i,t} × P_{i,t} × |E_{i,t}| × √T_t
- Commodity-level VaR: VaR_i = √( Σ_t VaR_{i,t}² )
- Portfolio VaR: √( wᵀ Σ w )
"""
import numpy as np
import pandas as pd
from scipy import stats
from datetime import date, datetime
from typing import Dict, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import (
    ExposureBucket, MarketPrice, Commodity, HedgeSession, HedgeSessionItem, Purchase
)
from app.utils.date_utils import months_until
import logging

logger = logging.getLogger(__name__)


class VaREngine:
    """VaR calculation engine"""
    
    def __init__(self, confidence_level: float = 0.95):
        self.confidence_level = confidence_level
        self.z_score = stats.norm.ppf(confidence_level)
    
    async def calculate_volatilities(
        self,
        db: AsyncSession,
        commodity_ids: List[str]
    ) -> Dict[str, float]:
        """
        Calculate annualized volatility for each commodity from historical returns
        """
        volatilities = {}
        
        for commodity_id in commodity_ids:
            # Get historical spot prices
            result = await db.execute(
                select(MarketPrice)
                .where(
                    MarketPrice.commodity_id == commodity_id,
                    MarketPrice.contract_month.is_(None)
                )
                .order_by(MarketPrice.price_date)
            )
            prices = result.scalars().all()
            
            if len(prices) < 2:
                logger.warning(f"Insufficient price data for commodity {commodity_id}")
                volatilities[str(commodity_id)] = 0.15  # Default 15% volatility
                continue
            
            # Calculate daily returns
            price_values = [float(p.price) for p in prices]
            returns = np.diff(np.log(price_values))
            
            # Annualize volatility (assuming 252 trading days)
            daily_volatility = np.std(returns)
            annual_volatility = daily_volatility * np.sqrt(252)
            
            volatilities[str(commodity_id)] = float(annual_volatility)
        
        return volatilities
    
    async def calculate_correlation_matrix(
        self,
        db: AsyncSession,
        commodity_ids: List[str]
    ) -> np.ndarray:
        """
        Calculate correlation matrix between commodities from historical returns
        """
        if len(commodity_ids) == 1:
            return np.array([[1.0]])
        
        # Get historical prices for all commodities
        returns_by_commodity = {}
        
        for commodity_id in commodity_ids:
            result = await db.execute(
                select(MarketPrice)
                .where(
                    MarketPrice.commodity_id == commodity_id,
                    MarketPrice.contract_month.is_(None)
                )
                .order_by(MarketPrice.price_date)
            )
            prices = result.scalars().all()
            
            if len(prices) < 2:
                returns_by_commodity[str(commodity_id)] = np.array([])
                continue
            
            price_values = [float(p.price) for p in prices]
            returns = np.diff(np.log(price_values))
            returns_by_commodity[str(commodity_id)] = returns
        
        # Create returns matrix (align by common dates)
        min_length = min(len(r) for r in returns_by_commodity.values() if len(r) > 0)
        
        if min_length == 0:
            # Default to no correlation
            n = len(commodity_ids)
            return np.eye(n)
        
        returns_matrix = np.array([
            returns_by_commodity[str(cid)][-min_length:] for cid in commodity_ids
        ])
        
        # Calculate correlation matrix
        correlation_matrix = np.corrcoef(returns_matrix)
        
        return correlation_matrix
    
    async def get_exposures_by_bucket(
        self,
        db: AsyncSession,
        customer_id: str,
        commodity_ids: List[str],
        start_date: date,
        end_date: date
    ) -> Dict[Tuple[str, date], float]:
        """
        Get exposure by commodity and bucket month FOR SPECIFIC CUSTOMER
        Returns dict: (commodity_id, bucket_month) -> quantity
        """
        result = await db.execute(
            select(ExposureBucket)
            .where(
                ExposureBucket.customer_id == customer_id,
                ExposureBucket.commodity_id.in_(commodity_ids),
                ExposureBucket.bucket_month >= start_date,
                ExposureBucket.bucket_month <= end_date
            )
        )
        buckets = result.scalars().all()
        
        exposures = {}
        for bucket in buckets:
            key = (str(bucket.commodity_id), bucket.bucket_month)
            if key in exposures:
                exposures[key] += float(bucket.quantity)
            else:
                exposures[key] = float(bucket.quantity)
        
        return exposures
    
    async def get_purchase_risk_info(
        self,
        db: AsyncSession,
        customer_id: str,
        commodity_ids: List[str],
        start_date: date,
        end_date: date,
        reference_date: date
    ) -> Dict[Tuple[str, date], Dict]:
        """
        Get risk information for each bucket based on source purchases
        Returns dict: (commodity_id, bucket_month) -> {
            'has_risk': bool,
            'price': float,
            'time_horizon_years': float
        }
        """
        # Get all exposure buckets with their source purchases
        result = await db.execute(
            select(ExposureBucket, Purchase)
            .join(Purchase, ExposureBucket.source_purchase_id == Purchase.id)
            .where(
                ExposureBucket.customer_id == customer_id,
                ExposureBucket.commodity_id.in_(commodity_ids),
                ExposureBucket.bucket_month >= start_date,
                ExposureBucket.bucket_month <= end_date
            )
        )
        rows = result.all()
        
        bucket_risk_info = {}
        for bucket, purchase in rows:
            key = (str(bucket.commodity_id), bucket.bucket_month)
            
            # Determine if this purchase has price risk
            has_risk = False
            effective_date = bucket.bucket_month  # Default: risk until delivery
            
            if purchase.price_type == 'floating':
                # Floating price: has risk until payment_date (or delivery if no payment_date)
                if purchase.payment_date:
                    # Risk until payment date
                    has_risk = purchase.payment_date > reference_date
                    effective_date = purchase.payment_date
                else:
                    # No payment date set, assume risk until delivery
                    has_risk = bucket.bucket_month > reference_date
                    effective_date = bucket.bucket_month
            else:
                # Fixed price: no risk
                has_risk = False
            
            # Calculate time horizon for risk (if any)
            time_horizon_years = 0.0
            if has_risk and effective_date > reference_date:
                days_until = (effective_date - reference_date).days
                time_horizon_years = max(days_until / 365.0, 0.01)  # Minimum 0.01 year
            
            # Aggregate if multiple buckets map to same key
            if key in bucket_risk_info:
                # If ANY source purchase has risk, the bucket has risk
                bucket_risk_info[key]['has_risk'] = bucket_risk_info[key]['has_risk'] or has_risk
                # Use the longest time horizon
                bucket_risk_info[key]['time_horizon_years'] = max(
                    bucket_risk_info[key]['time_horizon_years'],
                    time_horizon_years
                )
            else:
                bucket_risk_info[key] = {
                    'has_risk': has_risk,
                    'price': float(purchase.purchase_price),
                    'time_horizon_years': time_horizon_years
                }
        
        return bucket_risk_info
    
    async def get_hedge_quantities(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Dict[Tuple[str, date], float]:
        """
        Get hedge quantities from active hedge session
        Returns dict: (commodity_id, contract_month) -> quantity
        """
        # Find active hedge session
        result = await db.execute(
            select(HedgeSession)
            .where(
                HedgeSession.user_id == user_id,
                HedgeSession.status == 'active'
            )
        )
        session = result.scalar_one_or_none()
        
        if not session:
            return {}
        
        # Get hedge items
        result = await db.execute(
            select(HedgeSessionItem)
            .where(HedgeSessionItem.hedge_session_id == session.id)
        )
        items = result.scalars().all()
        
        hedges = {}
        for item in items:
            key = (str(item.commodity_id), item.contract_month)
            hedges[key] = float(item.quantity)
        
        return hedges
    
    async def get_forward_prices(
        self,
        db: AsyncSession,
        commodity_ids: List[str],
        reference_date: date
    ) -> Dict[Tuple[str, date], float]:
        """
        Get forward prices by commodity and contract month
        Returns dict: (commodity_id, contract_month) -> price
        """
        # Get futures prices
        result = await db.execute(
            select(MarketPrice)
            .where(
                MarketPrice.commodity_id.in_(commodity_ids),
                MarketPrice.contract_month.isnot(None)
            )
        )
        prices = result.scalars().all()
        
        forward_prices = {}
        for price in prices:
            key = (str(price.commodity_id), price.contract_month)
            forward_prices[key] = float(price.price)
        
        return forward_prices
    
    def calculate_bucket_var(
        self,
        volatility: float,
        forward_price: float,
        net_exposure: float,
        time_horizon_years: float
    ) -> float:
        """
        Calculate VaR for single bucket
        Formula: VaR_{i,t} = Z_α × σ_{i,t} × P_{i,t} × |E_{i,t}| × √T_t
        """
        var = (
            self.z_score *
            volatility *
            forward_price *
            abs(net_exposure) *
            np.sqrt(time_horizon_years)
        )
        return float(var)
    
    def calculate_commodity_var(self, bucket_vars: List[float]) -> float:
        """
        Aggregate VaR across time buckets for single commodity
        Formula: VaR_i = √( Σ_t VaR_{i,t}² )
        """
        sum_of_squares = sum(v ** 2 for v in bucket_vars)
        return float(np.sqrt(sum_of_squares))
    
    def calculate_portfolio_var(
        self,
        commodity_vars: List[float],
        correlation_matrix: np.ndarray
    ) -> float:
        """
        Calculate portfolio VaR using correlation matrix
        Formula: Portfolio VaR = √( wᵀ Σ w )
        where w is vector of commodity VaRs and Σ is covariance matrix
        """
        w = np.array(commodity_vars)
        
        # Covariance matrix from correlation matrix and VaRs
        # Cov = diag(w) @ Corr @ diag(w)
        portfolio_variance = w @ correlation_matrix @ w
        
        return float(np.sqrt(portfolio_variance))
    
    async def calculate_var_timeline(
        self,
        db: AsyncSession,
        user_id: str,
        customer_id: str,
        start_date: date,
        end_date: date,
        include_hedge: bool = False
    ) -> List[Dict]:
        """
        Calculate VaR timeline with or without hedge FOR SPECIFIC CUSTOMER
        Returns list of timeline points
        """
        # Get all commodities
        result = await db.execute(select(Commodity))
        commodities = result.scalars().all()
        commodity_ids = [str(c.id) for c in commodities]
        commodity_names = {str(c.id): c.name for c in commodities}
        
        # Calculate volatilities and correlations
        volatilities = await self.calculate_volatilities(db, commodity_ids)
        correlation_matrix = await self.calculate_correlation_matrix(db, commodity_ids)
        
        # Get exposures FOR THIS CUSTOMER ONLY
        exposures = await self.get_exposures_by_bucket(
            db, customer_id, commodity_ids, start_date, end_date
        )
        
        # Get purchase risk information (price_type, payment_date)
        reference_date = datetime.now().date()
        purchase_risk_info = await self.get_purchase_risk_info(
            db, customer_id, commodity_ids, start_date, end_date, reference_date
        )
        
        # Get hedges if requested
        hedges = {}
        if include_hedge:
            hedges = await self.get_hedge_quantities(db, user_id)
        
        # Get forward prices
        forward_prices = await self.get_forward_prices(db, commodity_ids, start_date)
        
        # Build timeline response - calculate both cost and VaR for each date
        timeline = []
        current_date = start_date
        scenario = "with_hedge" if include_hedge else "without_hedge"
        
        # Generate monthly timeline from start to end
        while current_date <= end_date:
            # Calculate VaR AND cost for this specific date (only buckets >= current_date)
            bucket_vars_by_commodity = {cid: [] for cid in commodity_ids}
            bucket_costs_by_commodity = {cid: 0.0 for cid in commodity_ids}
            
            # Process each exposure bucket that's still in the future from current_date
            for (commodity_id, bucket_month), exposure_qty in exposures.items():
                # Only include buckets that haven't delivered yet
                if bucket_month < current_date:
                    continue
                
                # Get hedge quantity for this bucket
                hedge_qty = hedges.get((commodity_id, bucket_month), 0)
                net_exposure = exposure_qty - hedge_qty
                
                # Get risk info for this bucket
                risk_info = purchase_risk_info.get((commodity_id, bucket_month), {
                    'has_risk': True,  # Default: assume risk
                    'price': 0.5,
                    'time_horizon_years': 1.0
                })
                
                # Get forward price for cost calculation
                forward_price = forward_prices.get((commodity_id, bucket_month))
                if not forward_price:
                    # Use purchase price as fallback
                    forward_price = risk_info.get('price', 0.5)
                
                # EXPECTED COST: always calculated (price × quantity)
                bucket_cost = forward_price * abs(net_exposure)
                bucket_costs_by_commodity[commodity_id] += bucket_cost
                
                # VAR: only calculated if purchase has risk
                if risk_info.get('has_risk', True):
                    # Get time horizon (use from risk_info or calculate)
                    time_horizon_years = risk_info.get('time_horizon_years')
                    if not time_horizon_years or time_horizon_years <= 0:
                        # Calculate from current_date to bucket_month as fallback
                        time_horizon_years = months_until(current_date, bucket_month) / 12.0
                        if time_horizon_years < 0.01:
                            time_horizon_years = 0.01
                    
                    # Calculate bucket VaR
                    volatility = volatilities.get(commodity_id, 0.15)
                    bucket_var = self.calculate_bucket_var(
                        volatility,
                        forward_price,
                        net_exposure,
                        time_horizon_years
                    )
                    bucket_vars_by_commodity[commodity_id].append(bucket_var)
                # else: VaR = 0 for fixed-price, already-paid orders
            
            # Calculate commodity-level VaRs and costs for this date
            commodity_vars = []
            commodity_var_dict = {}
            commodity_cost_dict = {}
            
            for commodity_id in commodity_ids:
                # VaR aggregation
                bucket_vars = bucket_vars_by_commodity[commodity_id]
                if bucket_vars:
                    commodity_var = self.calculate_commodity_var(bucket_vars)
                else:
                    commodity_var = 0.0
                commodity_vars.append(commodity_var)
                commodity_var_dict[commodity_names[commodity_id]] = commodity_var
                
                # Cost aggregation (simple sum)
                commodity_cost_dict[commodity_names[commodity_id]] = bucket_costs_by_commodity[commodity_id]
            
            # Calculate portfolio VaR and cost for this date
            portfolio_var = self.calculate_portfolio_var(commodity_vars, correlation_matrix)
            portfolio_cost = sum(bucket_costs_by_commodity.values())
            
            timeline.append({
                "date": current_date,
                "scenario": scenario,
                "expected_cost": {
                    "sugar": commodity_cost_dict.get("sugar", 0),
                    "flour": commodity_cost_dict.get("flour", 0),
                    "portfolio": portfolio_cost
                },
                "var": {
                    "sugar": commodity_var_dict.get("sugar", 0),
                    "flour": commodity_var_dict.get("flour", 0),
                    "portfolio": portfolio_var
                }
            })
            
            # Move to next month
            if current_date.month == 12:
                current_date = date(current_date.year + 1, 1, 1)
            else:
                current_date = date(current_date.year, current_date.month + 1, 1)
        
        return timeline
