"""
Agent AI package for natural language processing and sentiment analysis.
"""

# Importaciones principales
from agent_ai.protos import query_pb2, query_pb2_grpc
from agent_ai.ai import AIModelManager
from agent_ai.config import settings
from agent_ai.core.exceptions import ValidationError, ProcessingError

__version__ = "0.1.0"
__all__ = [
    'query_pb2',
    'query_pb2_grpc',
    'AIModelManager',
    'settings',
    'ValidationError',
    'ProcessingError'
]
