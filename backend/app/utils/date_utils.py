"""
Date utilities for bucketing and calculations
"""
from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List


def get_month_start(d: date) -> date:
    """Get first day of month for given date"""
    return date(d.year, d.month, 1)


def get_months_between(start_date: date, end_date: date) -> List[date]:
    """
    Get list of month start dates between start and end dates (inclusive)
    Returns first day of each month in the range
    """
    months = []
    current = get_month_start(start_date)
    end = get_month_start(end_date)
    
    while current <= end:
        months.append(current)
        current += relativedelta(months=1)
    
    return months


def months_until(from_date: date, to_date: date) -> float:
    """Calculate fractional months between two dates"""
    delta = relativedelta(to_date, from_date)
    return delta.years * 12 + delta.months + delta.days / 30.0
