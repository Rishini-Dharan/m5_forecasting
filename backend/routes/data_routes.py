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


@router.get("/insights")
def get_global_insights():
    """
    Returns mock global insight metrics that correspond to the UI layout.
    """
    # Generating mock trajectory data for the 30-day SVG chart
    trajectory_data = []
    # Just generating some abstract y-values to mirror the design's abstract shape
    for i in range(30):
        trajectory_data.append({"day": i, "value": 100 + (i * 2)})
        
    return {
        "projected_revenue": {
            "value": "$24.8M",
            "growth": "+12.4%",
            "trend": "up"
        },
        "confidence_interval": {
            "value": "94.2%",
            "status": "High Accuracy Model Active"
        },
        "anomalies": {
            "count": 2,
            "status": "Review Required"
        },
        "trajectory_data": trajectory_data,
        "key_drivers": [
            { "name": "Enterprise Licensing", "change": "+8.2%", "trend": "up" },
            { "name": "API Usage", "change": "+15.4%", "trend": "up" },
            { "name": "Professional Services", "change": "-2.1%", "trend": "down" }
        ],
        "jade_insight": "The recent surge in API usage strongly correlates with the rollout of v2.0. Recommending a capacity review for Q4."
    }
