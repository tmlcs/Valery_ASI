import pytest
import asyncio
from unittest.mock import Mock, patch
import zmq.asyncio
from agent_ai.zmq import ZMQManager, ZMQTimeoutError, ValidationError, ZMQConnectionError, zmq
from agent_ai.config import settings

# Constants
MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB

@pytest.fixture
async def zmq_manager():
    """Clean up manager after each test"""
    manager = ZMQManager.get_instance()
    # Ensure sockets are created in test context
    await manager.get_socket(zmq.REQ, "test://address")
    yield manager
    await manager.cleanup()
    ZMQManager._instance = None  # Reset singleton for next test

@pytest.mark.asyncio
async def test_singleton_pattern():
    manager1 = ZMQManager.get_instance()
    manager2 = ZMQManager.get_instance()
    assert manager1 is manager2

@pytest.mark.asyncio
async def test_connection_context():
    async with ZMQManager.get_instance().connection_context() as manager:
        assert isinstance(manager, ZMQManager)

@pytest.mark.asyncio
async def test_send_message_timeout():
    with patch('zmq.asyncio.Socket.send_string', side_effect=zmq.Again):
        with pytest.raises(ZMQTimeoutError):
            await ZMQManager.get_instance().send_message("test")

@pytest.mark.asyncio
async def test_circuit_breaker():
    manager = ZMQManager.get_instance()
    # Simulate multiple failures
    for _ in range(manager.circuit_breaker.failure_threshold + 1):
        manager.circuit_breaker.record_failure()
    
    with pytest.raises(ZMQConnectionError):
        await manager.send_message("test")

@pytest.mark.asyncio
async def test_reconnection():
    manager = ZMQManager.get_instance()
    with patch('zmq.asyncio.Socket.connect') as mock_connect:
        await manager.reconnect("test_address")
        mock_connect.assert_called_once()

@pytest.mark.asyncio
async def test_cleanup():
    manager = ZMQManager.get_instance()
    await manager.cleanup()
    assert not manager.sockets

@pytest.mark.asyncio
async def test_socket_timeout_config():
    """Test socket timeout configuration"""
    manager = ZMQManager.get_instance()
    try:
        socket = await manager.get_socket(zmq.REQ, "test://address")
        assert socket.getsockopt(zmq.RCVTIMEO) == settings.zmq_recv_timeout
        assert socket.getsockopt(zmq.SNDTIMEO) == settings.zmq_send_timeout
    finally:
        await manager.cleanup()
        ZMQManager._instance = None

@pytest.mark.asyncio
async def test_connection_failure():
    """Test connection failure handling"""
    manager = ZMQManager.get_instance()
    with pytest.raises(ZMQConnectionError):
        await manager.get_socket(zmq.REQ, "invalid://address")

@pytest.mark.asyncio
async def test_message_size_validation():
    """Test message size validation"""
    manager = ZMQManager.get_instance()
    large_message = "x" * (MAX_MESSAGE_SIZE + 1)
    with pytest.raises(ValidationError):
        await manager.send_message(large_message)

@pytest.mark.asyncio
async def test_concurrent_connections():
    """Test concurrent connection handling"""
    manager = ZMQManager.get_instance()
    async def connect():
        return await manager.get_socket(zmq.REQ, "test_address")
    
    sockets = await asyncio.gather(
        *(connect() for _ in range(5))
    )
    assert len(set(sockets)) == 5  # Unique sockets

@pytest.mark.asyncio
async def test_socket_cleanup():
    """Test socket cleanup on error"""
    manager = ZMQManager.get_instance()
    address = "test_cleanup"
    
    # Force an error
    with pytest.raises(Exception):
        async with manager.socket_context(zmq.REQ, address):
            raise Exception("Test error")
    
    # Check socket was cleaned up
    assert address not in manager.sockets

@pytest.mark.asyncio
async def test_backoff_retry():
    """Test exponential backoff retry"""
    manager = ZMQManager.get_instance()
    with patch('asyncio.sleep') as mock_sleep:
        with pytest.raises(ZMQConnectionError):
            await manager.reconnect("test_address")
        assert mock_sleep.call_count > 0

@pytest.mark.asyncio
async def test_memory_limits():
    """Test memory limit handling"""
    manager = ZMQManager.get_instance()
    with pytest.raises(ValidationError):
        large_message = "x" * (MAX_MESSAGE_SIZE + 1)
        await manager.send_message(large_message)
