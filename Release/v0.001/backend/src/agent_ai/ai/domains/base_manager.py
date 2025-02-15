from typing import Dict, Any, Optional, TypeVar, Generic, Type
from abc import ABC, abstractmethod
import datetime
from agent_ai.core.exceptions import ValidationError, ProcessingError
from agent_ai.logging import get_logger

RequestT = TypeVar('RequestT')
ResponseT = TypeVar('ResponseT')

class BaseAIManager(Generic[RequestT, ResponseT]):
    """Base class for all AI domain managers with standardized interface.
    
    Provides common functionality for:
    - Request validation
    - Error handling
    - Logging
    - Task execution
    
    Type Parameters:
        RequestT: The type of request this manager handles
        ResponseT: The type of response this manager returns
        
    Attributes:
        config (dict): Manager configuration parameters
        logger (Logger): Configured logging instance
    """
    
    def __init__(self, config: dict):
        """Initialize the base manager.
        
        Args:
            config (dict): Configuration parameters including:
                - logging: Logging configuration
                - validation: Validation rules
                - processing: Processing parameters
        """
        self.config = config
        self.logger = get_logger(self.__class__.__name__)
        
    @abstractmethod
    async def process_request(self, request: RequestT) -> ResponseT:
        """
        Main entry point for processing requests.
        
        Args:
            request: The request to process
            
        Returns:
            Processed response
            
        Raises:
            ValidationError: If request is invalid
            ProcessingError: If processing fails
        """
        raise NotImplementedError("Subclasses must implement process_request")

    async def _execute_task(self, request: RequestT, handlers: Dict[str, callable]) -> Any:
        """Execute a task with the appropriate handler."""
        if not hasattr(request, 'task_type'):
            raise ValidationError("Request must specify task_type")
            
        handler = handlers.get(request.task_type)
        if not handler:
            raise ValidationError(
                f"Unsupported task type: {request.task_type}",
                context={"supported_types": list(handlers.keys())}
            )
            
        try:
            return await handler(request)
        except Exception as e:
            self._handle_error(
                e, 
                f"executing_{request.task_type}",
                request_type=request.task_type
            )

    def _validate_request(self, request: RequestT) -> bool:
        """Validate incoming request.
        
        Args:
            request: Request to validate
            
        Returns:
            bool: True if request is valid
            
        Raises:
            ValidationError: If request is invalid with specific reason
        """
        if not request:
            raise ValidationError("Empty request")
            
        required_attrs = ['task_type', 'params']
        missing = [attr for attr in required_attrs if not hasattr(request, attr)]
        if missing:
            raise ValidationError(f"Missing required attributes: {', '.join(missing)}")
            
        return True

    def _log_operation(self, operation: str, **kwargs):
        self.logger.info(f"Processing {operation}", extra={
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "manager": self.__class__.__name__,
            **kwargs
        })

    def _handle_error(self, error: Exception, operation: str, **kwargs) -> None:
        """
        Handle errors uniformly across all managers.
        
        Args:
            error: The exception that occurred
            operation: Name of the operation that failed
            **kwargs: Additional context for logging
            
        Raises:
            ValidationError: If error is validation related
            ProcessingError: For all other errors
        """
        self.logger.error(
            f"Error in {operation}: {str(error)}", 
            extra={"manager": self.__class__.__name__, **kwargs},
            exc_info=True
        )
        
        if isinstance(error, ValidationError):
            raise error
        if not isinstance(error, ProcessingError):
            error = ProcessingError(f"Operation failed: {str(error)}")
        raise error

    async def _create_standard_response(self, success: bool = True, **kwargs) -> Dict:
        """Helper method to create standardized responses"""
        return {
            "success": success,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            **kwargs
        }

    @classmethod
    def create_handler_map(cls, handlers: Dict[str, callable]) -> Dict[str, callable]:
        """Helper to create a validated handler map"""
        return {
            task_type: handler 
            for task_type, handler in handlers.items()
            if callable(handler)
        }
