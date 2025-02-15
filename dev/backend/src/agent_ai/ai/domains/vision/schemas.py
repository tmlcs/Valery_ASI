from ..schemas import BaseRequest, BaseResponse
from typing import Dict, Any

class VisionRequest(BaseRequest):
    image_data: str
    task_type: str

class VisionResponse(BaseResponse):
    detections: Dict[str, Any]
