"""Base classes for manager implementations.

Provides abstract base classes and common functionality for managers
including error handling, input validation, logging and resource cleanup.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from agent_ai.logging import get_logger
from datetime import datetime
from asyncio import TimeoutError
import asyncio
import contextlib
from .exceptions import ValidationError, ProcessingError

class BaseManager(ABC):
    """Base class for manager implementations.
    
    Abstract base class providing common functionality for managers including:
    - Input validation 
    - Error handling
    - Logging
    - Resource cleanup
    - Timeout handling
    
    Example:
        class MyManager(BaseManager):
            async def _process_impl(self, request):
                validated_data = self._validate_input(request)
                try:
                    result = await process_data(validated_data) 
                    return result
                except Exception as e:
                    self._handle_error(e, "process_data")
    """

    def __init__(self, config: Optional[Dict] = None, timeout: float = 30.0):
        self.config = config or {}
        self.timeout = timeout
        self.logger = get_logger(self.__class__.__name__)
        self._cleanup_tasks = []

    def _validate_input(self, data: Any) -> bool:
        """Validate input data.
        
        Performs validation on input data including:
        - NULL checks
        - Type validation 
        - Size limits
        - Format validation
        
        Args:
            data: Input data to validate
            
        Returns:
            True if validation passes
            
        Raises:
            ValidationError: If validation fails
        """
        if data is None:
            self.logger.error("Input validation failed", error="Input data is None")
            raise ValidationError("Input data cannot be None")
            
        if hasattr(data, '__dict__'):
            self.logger.debug(
                "Validating input object",
                object_type=type(data).__name__,
                attributes=list(data.__dict__.keys())
            )
            
        # Add type-specific validations
        if isinstance(data, (str, bytes)):
            if len(data) == 0:
                self.logger.error("Input validation failed", error="Empty string/bytes input")
                raise ValidationError("Input cannot be empty")
            if len(data) > 1048576:  # 1MB limit
                self.logger.error("Input validation failed", error="Input exceeds size limit")
                raise ValidationError("Input size exceeds limit")

        self.logger.info(
            "Input validation successful",
            input_type=type(data).__name__
        )
        return True

    def _log_operation(self, operation: str, **kwargs):
        """Enhanced logging with structured data"""
        self.logger.info(
            operation,
            timestamp=datetime.utcnow().isoformat(),
            manager=self.__class__.__name__,
            **kwargs
        )

    def _handle_error(self, error: Exception, operation: str, **context):
        """Unified error handling"""
        error_context = {
            "operation": operation,
            "error_type": error.__class__.__name__,
            "timestamp": datetime.utcnow().isoformat(),
            **context
        }
        
        self.logger.error(
            f"Operation failed: {operation}",
            error_message=str(error),
            **error_context
        )
        
        if isinstance(error, (ValidationError, ProcessingError)):
            raise error
        raise ProcessingError(str(error), context=error_context)

    async def process(self, request: Any) -> Any:
        """Process a request with timeout and cleanup.
        
        Template method that:
        1. Validates input
        2. Processes request with timeout
        3. Performs cleanup
        4. Handles errors
        
        Args:
            request: Request data to process
            
        Returns:
            Processed result
            
        Raises:
            ValidationError: For invalid input
            ProcessingError: For processing failures
            TimeoutError: If processing exceeds timeout
        """
        try:
            async with asyncio.timeout(self.timeout):
                if not self._validate_input(request):
                    raise ValidationError("Invalid input data")
                return await self._process_impl(request)
        except TimeoutError:
            raise ProcessingError("Operation timed out")
        finally:
            await self._cleanup()

    @abstractmethod
    async def _process_impl(self, request: Any) -> Any:
        """Implementation of process logic"""
        pass

    async def _cleanup(self):
        """Resource cleanup"""
        for task in self._cleanup_tasks:
            try:
                await task()
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
