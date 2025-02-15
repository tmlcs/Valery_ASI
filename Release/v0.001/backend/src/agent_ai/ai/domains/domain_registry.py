from typing import Type, Dict
from .base_manager import BaseAIManager

class DomainRegistry:
    """Registry for domain managers."""
    _managers: Dict[str, Type[BaseAIManager]] = {}

    @classmethod
    def register(cls, domain_name: str, manager_class: Type[BaseAIManager]) -> None:
        cls._managers[domain_name] = manager_class

    @classmethod
    def get_manager(cls, domain_name: str) -> Type[BaseAIManager]:
        if domain_name not in cls._managers:
            raise KeyError(f"No manager registered for domain: {domain_name}")
        return cls._managers[domain_name]
