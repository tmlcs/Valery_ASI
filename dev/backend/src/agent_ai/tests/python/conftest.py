import pytest
import asyncio
import os
import zmq.asyncio
import json
from pathlib import Path
from agent_ai.config import AppSettings
from agent_ai.zmq import ZMQManager
from agent_ai.ai import AIModelManager

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for each test session"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_config():
    return AppSettings(
        zmq=AppSettings.ZMQConfig(
            host="127.0.0.1",
            port=5555
        ),
        ai=AppSettings.AIConfig(
            max_retries=3,
            max_memory_mb=1024
        )
    )

@pytest.fixture(scope="session")
def test_data_dir():
    return Path(__file__).parent / "data"

@pytest.fixture(autouse=True)
def setup_test_env():
    """Setup test environment variables"""
    os.environ["ZMQ_HOST"] = "localhost"
    os.environ["ZMQ_PORT"] = "5555"
    os.environ["MAX_MEMORY_MB"] = "1024"
    yield
    # Cleanup después de cada test

@pytest.fixture
async def zmq_context():
    context = zmq.asyncio.Context()
    yield context
    await context.term()

@pytest.fixture
def sample_query():
    return json.dumps({"message": "This is a test query"})

@pytest.fixture 
def sample_image():
    with open(test_data_dir() / "test_image.jpg", "rb") as f:
        return f.read()

@pytest.fixture
def mock_gpu_available():
    """Mock GPU availability for tests"""
    with patch('torch.cuda.is_available', return_value=True):
        yield

@pytest.fixture(autouse=True)
def cleanup_singletons():
    yield
    # Reset singletons after each test
    ZMQManager._instance = None
    AIModelManager._instance = None
