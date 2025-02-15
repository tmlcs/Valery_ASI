from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from .models import (
    QueryModelV1, 
    QueryResponseV1,
    ErrorResponse,
    APIVersion
)
from agent_ai.ai import AIModelManager
from agent_ai.core.exceptions import ValidationError, ProcessingError

router = APIRouter(
    prefix="/api/v1",
    tags=["v1"],
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)

@router.get("/version")
async def get_version():
    """Get current API version"""
    return {"version": APIVersion.V1}

# Move existing endpoints here and update their models
@router.post("/process", response_model=QueryResponseV1)
async def process_query(request: QueryModelV1):
    """
    Process text query using AI models.

    Performs comprehensive analysis including:
    - Sentiment analysis
    - Emotion detection
    - Topic classification
    
    Rate limit: 100 requests/minute

    Args:
        request: Query model containing text to analyze
        
    Returns:
        QueryResponseV1: Analysis results
        
    Raises:
        400: Invalid input
        401: Unauthorized
        429: Rate limit exceeded
        503: Service temporarily unavailable
    """
    try:
        ai_manager = AIModelManager.get_instance()
        result = await ai_manager.process_query(request.query)
        return QueryResponseV1(
            results=result,
            metadata={"model_version": ai_manager.model_version}
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add more endpoints following the same pattern
