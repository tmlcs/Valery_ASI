from agent_ai.fastapi import app
from agent_ai.config import settings, configure_logging, validate_env
import logging
import os

logger = logging.getLogger(__name__)

def initialize_app() -> None:
    """Inicializa la aplicación con configuración y validación"""
    validate_env()
    configure_logging(settings.logging.level)
    logger.info("Starting application with configuration:\n%s", settings.json(indent=2))

if __name__ == "__main__":
    initialize_app()

# Export para uvicorn
__all__ = ['app']
