import logging
from pydantic import BaseModel, validator
from ..schemas import BaseRequest, BaseResponse
from typing import List, Dict

logger = logging.getLogger(__name__)

class IoTRequest(BaseRequest):
    device_data: str
    analysis_type: str

    @validator("device_type")
    def validate_device_type(cls, v):
        logger.debug("Validando device_type", extra={"device_type": v})
        return v

class IoTResponse(BaseResponse):
    status: str
    metrics: Dict[str, float]
    alerts: List[str]

    @validator("status")
    def validate_status(cls, v):
        logger.debug("Validando status", extra={"status": v})
        return v
