from typing import Dict, Any, Optional
from agent_ai.core.exceptions import ValidationError
from agent_ai.core.base import BaseManager
from .domains import get_domain_manager

class AIModelManager(BaseManager):
    _instance = None
    
    @classmethod
    def get_instance(cls) -> 'AIModelManager':
        if cls._instance is None:
            try:
                cls._instance = cls()
            except Exception as e:
                raise RuntimeError(f"Failed to initialize AIModelManager: {e}")
        return cls._instance
    
    def __init__(self):
        super().__init__()
        self.domain_managers: Dict[str, Any] = {}

    def get_domain_manager(self, domain: str) -> Any:
        if domain not in self.domain_managers:
            manager_class = get_domain_manager(domain)
            self.domain_managers[domain] = manager_class(self.config)
        return self.domain_managers[domain]

    async def _process_impl(self, request: Any) -> Any:
        """Implementation of process logic"""
        try:
            domain = request.get('domain', 'default')
            manager = self.get_domain_manager(domain)
            return await manager.process(request)
        except Exception as e:
            self._handle_error(e, "process_request")