from ..schemas import BaseRequest, BaseResponse
from typing import List, Optional

class SecurityRequest(BaseRequest):
    analysis_type: str
    log_data: str

class SecurityResponse(BaseResponse):
    critical_level: str
    findings: List[str]
    recommendation: str
