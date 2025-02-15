import pytest
from agent_ai.config import AppSettings, configure_logging
import os
import logging
from typing import Dict, Any

@pytest.fixture
def env_vars() -> Dict[str, Any]:
    """Setup test environment variables"""
    return {
        "ZMQ_HOST": "127.0.0.1",
        "ZMQ_PORT": "5555",
        "LOG_LEVEL": "INFO",
        "FAILURE_THRESHOLD": "3",
        "RESET_TIMEOUT": "30",
        "MAX_RETRIES": "3",
        "ZMQ_RECV_TIMEOUT": "15000",
        "ZMQ_SEND_TIMEOUT": "15000"
    }

@pytest.fixture
def setup_env(env_vars):
    """Setup and teardown environment variables"""
    original = {}
    for key, value in env_vars.items():
        if key in os.environ:
            original[key] = os.environ[key]
        os.environ[key] = str(value)  # Ensure values are strings
    
    yield
    
    for key in env_vars:
        if key in original:
            os.environ[key] = original[key]
        else:
            del os.environ[key]

def test_validate_env(setup_env, env_vars):
    """Test environment validation"""
    settings = AppSettings()
    assert settings.zmq_host == env_vars["ZMQ_HOST"]
    assert settings.zmq_port == int(env_vars["ZMQ_PORT"])
    assert settings.log_level == env_vars["LOG_LEVEL"]

def test_config_validation(setup_env):
    """Test configuration validation"""
    settings = AppSettings()
    assert settings.zmq_port > 1024
    assert settings.zmq_port < 65535
    assert settings.zmq_recv_timeout > 0
    assert settings.zmq_send_timeout > 0
    assert settings.max_memory_mb > 0
    assert settings.failure_threshold > 0

def test_logging_config():
    """Test logging configuration"""
    # Reset logging config before test
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    configure_logging()
    logger = logging.getLogger('agent_ai')
    assert logger.level == logging.INFO
    
    configure_logging('DEBUG')
    assert logger.level == logging.DEBUG

@pytest.mark.parametrize("level", ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
def test_valid_log_levels(level):
    """Test valid log levels are accepted"""
    settings = AppSettings(log_level=level)
    assert settings.log_level == level
