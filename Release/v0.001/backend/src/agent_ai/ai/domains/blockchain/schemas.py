from ..schemas import BaseRequest, BaseResponse
from typing import List, Dict

class BlockchainRequest(BaseRequest):
    transaction_data: str
    analysis_type: str

class BlockchainResponse(BaseResponse):
    validity: bool
    risk_score: float
    findings: List[str]
