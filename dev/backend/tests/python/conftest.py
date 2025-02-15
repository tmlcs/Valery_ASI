import pytest
import asyncio
import os

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for each test session"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True)
def setup_test_env():
    """Setup test environment variables"""
    os.environ["ZMQ_HOST"] = "localhost"
    os.environ["ZMQ_PORT"] = "5555"
    os.environ["MAX_MEMORY_MB"] = "1024"
    yield
    # Cleanup después de cada test

@pytest.fixture
def mock_gpu_available():
    """Mock GPU availability for tests"""
    with patch('torch.cuda.is_available', return_value=True):
        yield
