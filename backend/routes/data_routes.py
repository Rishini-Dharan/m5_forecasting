from fastapi import APIRouter
from pydantic import BaseModel
from db.db import db
from typing import List

router = APIRouter()

class HistoricalDataRequest(BaseModel):
    item_id: str
    store_id: str

class DataPoint(BaseModel):
    day: int
    sales: int

@router.post("/historical", response_model=List[DataPoint])
def get_historical_data(req: HistoricalDataRequest):
    query = """
        SELECT day_index, sales 
        FROM historical_sales 
        WHERE item_id = %s AND store_id = %s 
        ORDER BY day_index ASC
    """
    
    results = db.execute_query(query, (req.item_id, req.store_id), fetch=True)
    
    if not results:
        return []
        
    return [{"day": row[0], "sales": row[1]} for row in results]
