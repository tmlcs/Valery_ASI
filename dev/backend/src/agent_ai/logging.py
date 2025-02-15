import structlog
import logging.config
import os
from typing import Dict, Any
from datetime import datetime

# Configuración base para loggers
DEFAULT_LOG_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s [%(levelname)s] [%(name)s:%(lineno)d] %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
        'json': {
            '()': 'structlog.stdlib.ProcessorFormatter',
            'processor': structlog.processors.JSONRenderer(),
        }
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'formatter': 'standard',
            'class': 'logging.StreamHandler',
            'stream': 'ext://sys.stdout'
        },
        'file': {
            'level': 'INFO',
            'formatter': 'json',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5
        }
    },
    'loggers': {
        'agent_ai': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False
        }
    }
}

def setup_logging(config: Dict[str, Any] = None) -> None:
    """Configura el sistema de logging.
    
    Args:
        config: Configuración opcional que sobreescribe los valores por defecto
    """
    log_config = DEFAULT_LOG_CONFIG.copy()
    if config:
        # Merge handlers carefully
        if 'handlers' in config:
            for handler_name, handler_config in config['handlers'].items():
                if handler_name in log_config['handlers']:
                    log_config['handlers'][handler_name].update(handler_config)
        # Merge loggers carefully
        if 'loggers' in config:
            for logger_name, logger_config in config['loggers'].items():
                if logger_name in log_config['loggers']:
                    log_config['loggers'][logger_name].update(logger_config)

    # Asegurar que existe el directorio de logs
    os.makedirs('logs', exist_ok=True)

    # Configurar logging estándar
    logging.config.dictConfig(log_config)

    # Configurar structlog
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
            structlog.stdlib.add_logger_name,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

def get_logger(name: str) -> structlog.BoundLogger:
    """Obtiene un logger configurado para el módulo especificado.
    
    Args:
        name: Nombre del módulo/logger
        
    Returns:
        Logger configurado
    """
    return structlog.get_logger(name)
