from ..schemas import BaseRequest, BaseResponse
from typing import List, Dict

class BusinessRequest(BaseRequest):
    business_data: str
    analysis_type: str

class BusinessResponse(BaseResponse):
    insights: List[str]
    metrics: Dict[str, float]
    recommendations: List[str]
