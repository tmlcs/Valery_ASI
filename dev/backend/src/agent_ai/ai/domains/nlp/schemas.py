from ..schemas import BaseRequest, BaseResponse
from typing import Dict, Any

class NLPRequest(BaseRequest):
    text: str
    task_type: str
    language: str = "en"

class NLPResponse(BaseResponse):
    results: Dict[str, Any]
