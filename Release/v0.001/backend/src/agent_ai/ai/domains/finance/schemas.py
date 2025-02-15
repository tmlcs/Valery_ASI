from ..schemas import BaseRequest, BaseResponse
from typing import List, Dict

class FinanceRequest(BaseRequest):
    financial_data: str
    analysis_type: str

class FinanceResponse(BaseResponse):
    risk_level: str
    metrics: Dict[str, float]
    recommendations: List[str]
