"""Domain managers module."""

from typing import Type
from .base_manager import BaseAIManager
from .domain_registry import DomainRegistry
from agent_ai.core.exceptions import (
    DomainError,
    SecurityAnalysisError,
    BusinessAnalysisError,
    MedicalAnalysisError,
    NLPProcessingError,
    VisionProcessingError
)

def get_domain_manager(domain_name: str) -> Type[BaseAIManager]:
    """Factory function for getting domain-specific AI managers.
    
    Args:
        domain_name (str): Name of the domain to get manager for.
            Supported domains: 'vision', 'nlp', 'security', 'medical', 'business'
            
    Returns:
        Type[BaseAIManager]: Manager class for the specified domain
        
    Raises:
        DomainError: If domain_name is not supported
        
    Example:
        >>> VisionManager = get_domain_manager('vision')
        >>> manager = VisionManager(config)
    """
    return DomainRegistry.get_manager(domain_name)
