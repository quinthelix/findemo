"""
Excel file parsing and validation utilities
"""
import pandas as pd
from typing import List, Dict
from datetime import date
from io import BytesIO


def parse_purchases_excel(file_content: bytes) -> List[Dict]:
    """
    Parse purchases Excel file
    
    Expected columns:
    - commodity: str (sugar or flour)
    - purchase_date: date
    - delivery_start_date: date
    - delivery_end_date: date
    - quantity: float
    - unit: str
    - purchase_price: float
    """
    try:
        df = pd.read_excel(BytesIO(file_content))
        
        # Validate required columns
        required_columns = [
            'commodity', 'purchase_date', 'delivery_start_date',
            'delivery_end_date', 'quantity', 'unit', 'purchase_price'
        ]
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Convert to list of dictionaries
        purchases = []
        for _, row in df.iterrows():
            purchase = {
                'commodity': str(row['commodity']).lower().strip(),
                'purchase_date': pd.to_datetime(row['purchase_date']).date(),
                'delivery_start_date': pd.to_datetime(row['delivery_start_date']).date(),
                'delivery_end_date': pd.to_datetime(row['delivery_end_date']).date(),
                'quantity': float(row['quantity']),
                'unit': str(row['unit']).strip(),
                'purchase_price': float(row['purchase_price'])
            }
            
            # Validate commodity
            if purchase['commodity'] not in ['sugar', 'flour']:
                raise ValueError(f"Invalid commodity: {purchase['commodity']}. Must be 'sugar' or 'flour'")
            
            # Validate dates
            if purchase['delivery_end_date'] < purchase['delivery_start_date']:
                raise ValueError(f"Delivery end date must be >= start date")
            
            # Validate positive values
            if purchase['quantity'] <= 0:
                raise ValueError(f"Quantity must be positive")
            if purchase['purchase_price'] <= 0:
                raise ValueError(f"Purchase price must be positive")
            
            purchases.append(purchase)
        
        return purchases
        
    except Exception as e:
        raise ValueError(f"Error parsing purchases Excel: {str(e)}")


def parse_inventory_excel(file_content: bytes) -> List[Dict]:
    """
    Parse inventory Excel file
    
    Expected columns:
    - date: date
    - commodity: str (sugar or flour)
    - quantity: float
    """
    try:
        df = pd.read_excel(BytesIO(file_content))
        
        # Validate required columns
        required_columns = ['date', 'commodity', 'quantity']
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Convert to list of dictionaries
        inventory_items = []
        for _, row in df.iterrows():
            item = {
                'date': pd.to_datetime(row['date']).date(),
                'commodity': str(row['commodity']).lower().strip(),
                'quantity': float(row['quantity'])
            }
            
            # Validate commodity
            if item['commodity'] not in ['sugar', 'flour']:
                raise ValueError(f"Invalid commodity: {item['commodity']}. Must be 'sugar' or 'flour'")
            
            # Validate non-negative quantity
            if item['quantity'] < 0:
                raise ValueError(f"Inventory quantity must be non-negative")
            
            inventory_items.append(item)
        
        return inventory_items
        
    except Exception as e:
        raise ValueError(f"Error parsing inventory Excel: {str(e)}")


def create_sample_purchases_excel() -> bytes:
    """Create a sample purchases Excel file for reference"""
    data = {
        'commodity': ['sugar', 'flour'],
        'purchase_date': ['2026-01-15', '2026-01-16'],
        'delivery_start_date': ['2026-02-01', '2026-02-01'],
        'delivery_end_date': ['2026-04-30', '2026-04-30'],
        'quantity': [50000, 40000],
        'unit': ['kg', 'kg'],
        'purchase_price': [0.52, 0.40]
    }
    
    df = pd.DataFrame(data)
    output = BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return output.getvalue()


def create_sample_inventory_excel() -> bytes:
    """Create a sample inventory Excel file for reference"""
    data = {
        'date': ['2026-01-20', '2026-01-20'],
        'commodity': ['sugar', 'flour'],
        'quantity': [15000, 12000]
    }
    
    df = pd.DataFrame(data)
    output = BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return output.getvalue()
