import pytest
from fastapi.testclient import TestClient
from agent_ai.fastapi.fastapi import app
from agent_ai.config import settings
from agent_ai.zmq import ZMQTimeoutError
from unittest.mock import patch, Mock, AsyncMock
import torch
import json
from agent_ai.ai import AIModelManager

# More robust mock
class MockAIModelManager:
    def __init__(self):
        self._instance = None
    
    @classmethod
    def get_instance(cls):
        if not hasattr(cls, '_instance'):
            cls._instance = cls()
        return cls._instance

    async def combined_analysis(self, text):
        return {
            "sentiment": Mock(
                label="positive",
                score=0.9,
                details={"rating": 4.5}
            ),
            "emotion": Mock(
                label="happy",
                score=0.8
            ),
            "topic": Mock(
                label="technology",
                score=0.95,
                details={
                    "all_labels": ["technology", "science"],
                    "all_scores": [0.95, 0.75]
                }
            )
        }

@pytest.fixture
def client():
    """Create test client with mocked AI model"""
    with patch('agent_ai.fastapi.AIModelManager', MockAIModelManager), \
         patch('agent_ai.fastapi.ZMQManager', new_callable=AsyncMock):
        with TestClient(app) as test_client:
            yield test_client

def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert "status" in response.json()

def test_process_invalid_query(client):
    response = client.post("/api/v1/process", json={"query": ""})
    assert response.status_code == 400

def test_process_valid_query(client):
    test_query = {"query": "Test query"}
    mock_result = {
        "sentiment": {"label": "positive", "score": 0.9},
        "status": "success"
    }
    
    with patch.object(AIModelManager, 'combined_analysis') as mock_analysis:
        mock_analysis.return_value = mock_result
        response = client.post("/api/v1/process", json=test_query)
        
    assert response.status_code == 200
    assert "sentiment" in response.json()

@pytest.mark.asyncio
async def test_detect_objects_endpoint(client):
    test_image = {"image": "base64_encoded_image"}
    mock_result = {"objects": ["person", "car"]}
    
    with patch.object(AIModelManager, 'detect_objects') as mock_detect:
        mock_detect.return_value = mock_result
        response = client.post("/api/v1/ai/vision/detect-objects", json=test_image)
        
    assert response.status_code == 200
    assert "objects" in response.json()

def test_process_query_validation(client):
    # Test con query vacía
    response = client.post("/process", json={"query": ""})
    assert response.status_code == 400

    # Test con query muy larga
    long_query = "a" * 2000
    response = client.post("/process", json={"query": long_query})
    assert response.status_code == 400

def test_process_query_success(client):
    """Test successful query processing"""
    response = client.post(
        "/process",
        json={"query": "This is a great product!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "sentiment" in data
    assert "emotion" in data
    assert "topic" in data

def test_cors_headers(client):
    response = client.options("/process")
    assert response.status_code == 204
    assert "access-control-allow-origin" in response.headers
    assert "access-control-allow-methods" in response.headers

@pytest.mark.asyncio
async def test_zmq_timeout(client):
    with patch('agent_ai.zmq.ZMQManager.send_message', 
              new_callable=AsyncMock, 
              side_effect=ZMQTimeoutError):
        response = client.post("/process", json={"query": "test"})
        assert response.status_code == 504

@pytest.mark.asyncio
async def test_resource_cleanup(client):
    """Test resource cleanup after request"""
    with patch('torch.cuda.memory_allocated', return_value=1000), \
         patch('torch.cuda.is_available', return_value=True):
        response = client.post(
            "/process",
            json={"query": "Test query"}
        )
        assert response.status_code == 200

def test_concurrent_requests(client):
    """Test handling of concurrent requests"""
    import concurrent.futures
    
    def make_request():
        response = client.post(
            "/process",
            json={"query": "Test query"}
        )
        assert response.status_code == 200
        assert "response" in response.json()
        return response
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(make_request) for _ in range(3)]
        responses = [f.result() for f in futures]
    
    assert all(r.status_code == 200 for r in responses)

def test_error_responses(client):
    """Test various error responses"""
    # Test invalid JSON
    response = client.post(
        "/process",
        data="invalid json"
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid JSON"
    
    # Test missing required field
    response = client.post(
        "/process",
        json={"invalid_field": "test"}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Missing required field: query"
    
    # Test method not allowed
    response = client.put("/process", json={"query": "test"})
    assert response.status_code == 405
    assert response.json()["detail"] == "Method Not Allowed"

def test_health_check_details(client):
    """Test detailed health check response"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data["status"], str)
    assert isinstance(data["tensorflow_model"], str)
    assert isinstance(data["zmq_status"], str)
    
    # Test cache control header
    assert response.headers["cache-control"] == "no-cache"

@pytest.mark.asyncio
async def test_memory_limits(client):
    """Test memory limit handling"""
    with patch('torch.cuda.is_available', return_value=True):
        with patch('torch.cuda.memory_allocated', return_value=settings.max_memory_mb * 1024 * 1024):
            response = client.post(
                "/process",
                json={"query": "Test query"}
            )
            assert response.status_code == 503

def test_file_upload_validations(client):
    """Test comprehensive file upload validations"""
    # Test non-image file
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.txt", b"test content", "text/plain")}
    )
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

    # Test empty file
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.jpg", b"", "image/jpeg")}
    )
    assert response.status_code == 400
    assert "Empty file" in response.json()["detail"]

    # Test oversized file
    large_content = b"x" * (10 * 1024 * 1024 + 1)  # 10MB + 1 byte
    response = client.post(
        "/api/v1/upload",
        files={"file": ("large.jpg", large_content, "image/jpeg")}
    )
    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]
