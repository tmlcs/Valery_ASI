from ..schemas import BaseRequest, BaseResponse
from typing import List, Dict

class MedicalRequest(BaseRequest):
    patient_data: str
    analysis_type: str

class MedicalResponse(BaseResponse):
    diagnosis: str
    confidence: float
    recommendations: List[str]
