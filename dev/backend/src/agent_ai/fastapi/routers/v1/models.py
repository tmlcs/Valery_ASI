from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime

class APIVersion:
    V1 = "1.0.0"

class BaseAPIRequest(BaseModel):
    """Base model for all API requests"""
    version: str = Field(default=APIVersion.V1, description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
class BaseAPIResponse(BaseModel):
    """Base model for all API responses"""
    version: str = Field(default=APIVersion.V1, description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="success")
    
class ErrorResponse(BaseAPIResponse):
    """Standard error response"""
    status: str = "error"
    error: str
    detail: Optional[str] = None
    
# Versioned request/response models
class QueryModelV1(BaseAPIRequest):
    query: str = Field(..., description="Query text to analyze")
    
class QueryResponseV1(BaseAPIResponse):
    results: Dict[str, Any]
    metadata: Optional[Dict[str, Any]]

# Add more versioned models as needed
