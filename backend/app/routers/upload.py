"""
Upload router
POST /upload/purchases - Upload purchases Excel
POST /upload/inventory - Upload inventory Excel
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User, Purchase, InventorySnapshot, Commodity
from app.models.schemas import UploadResponse
from app.utils.excel_parser import parse_purchases_excel, parse_inventory_excel
from app.services.exposure_service import rebuild_exposure_buckets

router = APIRouter()


@router.post("/purchases", response_model=UploadResponse)
async def upload_purchases(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload purchases Excel file
    
    Expected columns:
    - commodity: str (sugar or flour)
    - purchase_date: date
    - delivery_start_date: date
    - delivery_end_date: date
    - quantity: float
    - unit: str
    - purchase_price: float
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse Excel
        purchases_data = parse_purchases_excel(content)
        
        if not purchases_data:
            raise HTTPException(status_code=400, detail="No valid purchases found in file")
        
        # Get commodity mappings
        result = await db.execute(select(Commodity))
        commodities = {c.name: c for c in result.scalars().all()}
        
        # Insert purchases
        rows_processed = 0
        for purchase_data in purchases_data:
            commodity = commodities.get(purchase_data['commodity'])
            if not commodity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown commodity: {purchase_data['commodity']}"
                )
            
            purchase = Purchase(
                customer_id=current_user.customer_id,
                commodity_id=commodity.id,
                purchase_date=purchase_data['purchase_date'],
                delivery_start_date=purchase_data['delivery_start_date'],
                delivery_end_date=purchase_data['delivery_end_date'],
                quantity=purchase_data['quantity'],
                unit=purchase_data['unit'],
                purchase_price=purchase_data['purchase_price'],
                price_type=purchase_data.get('price_type', 'fixed'),
                payment_date=purchase_data.get('payment_date')
            )
            db.add(purchase)
            rows_processed += 1
        
        await db.commit()
        
        # Rebuild exposure buckets FOR THIS CUSTOMER ONLY
        buckets_created = await rebuild_exposure_buckets(db, str(current_user.customer_id))
        
        return UploadResponse(
            message=f"Successfully uploaded {rows_processed} purchases",
            rows_processed=rows_processed,
            exposure_buckets_created=buckets_created
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/inventory", response_model=UploadResponse)
async def upload_inventory(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload inventory Excel file
    
    Expected columns:
    - date: date
    - commodity: str (sugar or flour)
    - quantity: float
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse Excel
        inventory_data = parse_inventory_excel(content)
        
        if not inventory_data:
            raise HTTPException(status_code=400, detail="No valid inventory items found in file")
        
        # Get commodity mappings
        result = await db.execute(select(Commodity))
        commodities = {c.name: c for c in result.scalars().all()}
        
        # Insert inventory snapshots
        rows_processed = 0
        for item_data in inventory_data:
            commodity = commodities.get(item_data['commodity'])
            if not commodity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown commodity: {item_data['commodity']}"
                )
            
            snapshot = InventorySnapshot(
                customer_id=current_user.customer_id,
                date=item_data['date'],
                commodity_id=commodity.id,
                quantity=item_data['quantity']
            )
            db.add(snapshot)
            rows_processed += 1
        
        await db.commit()
        
        return UploadResponse(
            message=f"Successfully uploaded {rows_processed} inventory snapshots",
            rows_processed=rows_processed
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
