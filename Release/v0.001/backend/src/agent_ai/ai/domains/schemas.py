from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class BaseRequest(BaseModel):
    """Base request model for all domains"""
    params: Optional[Dict[str, Any]] = {}
    timestamp: datetime = datetime.utcnow()

class BaseResponse(BaseModel):
    """Base response model for all domains"""
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    metadata: Optional[Dict[str, Any]] = {}
