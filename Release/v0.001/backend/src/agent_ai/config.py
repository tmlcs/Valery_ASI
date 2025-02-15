"""Configuration management module."""

from __future__ import annotations
import os
import logging
import logging.config
import structlog
from typing import Any, Callable, TypeVar
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings
from pydantic.types import PositiveInt, conint
from prometheus_client import Counter, Histogram
import ipaddress
from pathlib import Path
from agent_ai.core.exceptions import ValidationError
from agent_ai.logging import setup_logging, get_logger

T = TypeVar('T')

# Metrics
REQUESTS = Counter('zmq_requests_total', 'Total ZMQ requests')
FAILURES = Counter('zmq_failures_total', 'Total ZMQ failures')
LATENCY = Histogram('zmq_request_latency_seconds', 'Request latency')

class AppSettings(BaseSettings):
    """Base configuration model with common settings"""
    
    class ZMQConfig(BaseSettings):
        host: str = Field(
            default='127.0.0.1',
            description="ZeroMQ server host address",
            env='ZMQ_HOST'
        )
        port: int = Field(
            default=5555,
            gt=1024,
            lt=65535,
            description="ZeroMQ server port",
            env='ZMQ_PORT'
        )
        recv_timeout_ms: PositiveInt = Field(
            default=15000,
            description="ZeroMQ receive timeout in milliseconds",
            env='ZMQ_RECV_TIMEOUT'
        )
        send_timeout_ms: PositiveInt = Field(
            default=15000,
            description="ZeroMQ send timeout in milliseconds",
            env='ZMQ_SEND_TIMEOUT'
        )

        @field_validator('host')
        def validate_host(cls, v):
            try:
                ipaddress.ip_address(v)
                return v
            except ValueError:
                raise ValidationError("Invalid IP address format")

        @field_validator('port')
        def validate_port(cls, v):
            if not 1024 <= v <= 65535:
                raise ValidationError("Port must be between 1024 and 65535")
            return v

        @field_validator('recv_timeout_ms', 'send_timeout_ms')
        def validate_timeouts(cls, v):
            if v < 1000 or v > 60000:  # Entre 1s y 60s
                raise ValidationError("Timeout must be between 1000ms and 60000ms")
            return v

    class AIConfig(BaseSettings):
        failure_threshold: PositiveInt = Field(
            default=3,
            description="Maximum consecutive failures before circuit break",
            env='AI_FAILURE_THRESHOLD'
        )
        reset_timeout_sec: PositiveInt = Field(
            default=30,
            description="Circuit breaker reset timeout in seconds",
            env='AI_RESET_TIMEOUT'
        )
        max_retries: conint(ge=0, le=5) = Field(
            default=3,
            description="Maximum retry attempts for AI operations",
            env='AI_MAX_RETRIES'
        )
        max_memory_mb: PositiveInt = Field(
            default=1024,
            description="Maximum memory allocation for AI models in MB",
            env='AI_MAX_MEMORY'
        )

    class LoggingConfig(BaseSettings):
        level: str = Field(
            default='INFO',
            description="Application logging level",
            env='LOG_LEVEL'
        )
        pool_max_workers: PositiveInt = Field(
            default=10,
            description="Maximum workers for logging thread pool",
            env='LOG_POOL_WORKERS'
        )

    zmq: ZMQConfig = ZMQConfig()
    ai: AIConfig = AIConfig()
    logging: LoggingConfig = LoggingConfig()
    
    def __init__(self):
        try:
            super().__init__()
        except Exception as e:
            raise RuntimeError(f"Failed to load configuration: {e}")

    model_config = {
        'env_file': '.env',
        'env_file_encoding': 'utf-8',
        'extra': 'ignore',
        'case_sensitive': False
    }

# Create alias for backward compatibility
Config = BaseSettings

def configure_logging(level: str = 'INFO') -> None:
    """Enhanced logging configuration with structured logging"""
    log_config = {
        'loggers': {
            'agent_ai': {'level': level}
        }
    }
    setup_logging(log_config)

def validate_env() -> None:
    """Validate required environment variables"""
    required_vars = ['ZMQ_HOST', 'ZMQ_PORT']
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")

# Configuración inicial
settings = AppSettings()
configure_logging(settings.logging.level)

# Expose pool_max_workers for legacy imports
POOL_MAX_WORKERS = settings.logging.pool_max_workers
