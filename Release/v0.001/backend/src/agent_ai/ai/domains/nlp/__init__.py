from ..domain_registry import DomainRegistry
from .manager import NLPManager
from .schemas import NLPRequest, NLPResponse
from agent_ai.core.exceptions import NLPProcessingError

DomainRegistry.register('nlp', NLPManager)

__all__ = [
    'NLPManager',
    'NLPRequest',
    'NLPResponse',
    'NLPProcessingError'
]
