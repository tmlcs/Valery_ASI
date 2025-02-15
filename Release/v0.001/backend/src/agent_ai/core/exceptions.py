"""Core exceptions for the application."""

class AIBaseException(Exception):
    """Base exception class for AI related errors."""
    def __init__(self, message: str, context: dict = None, cause: Exception = None):
        self.message = message
        self.context = context or {}
        self.__cause__ = cause
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.context:
            return f"{self.message} (context: {self.context})"
        return self.message

class ValidationError(AIBaseException):
    """Raised when validation fails."""
    pass

class ProcessingError(AIBaseException):
    """Raised when processing fails."""
    pass

class ResourceError(AIBaseException):
    """Raised when a resource operation fails."""
    pass

class DomainError(AIBaseException):
    """Base exception for domain-specific errors."""
    pass

# Domain specific exceptions
class SecurityAnalysisError(DomainError):
    """Raised when security analysis fails."""
    pass

class BusinessAnalysisError(DomainError):
    """Raised when business analysis fails."""
    pass

class MedicalAnalysisError(DomainError):
    """Raised when medical analysis fails."""
    pass

class NLPProcessingError(DomainError):
    """Raised when NLP processing fails."""
    pass

class IoTAnalysisError(DomainError):
    """Raised when IoT analysis fails."""
    pass

class VisionProcessingError(DomainError):
    """Raised when vision processing fails."""
    pass

class ZMQConnectionError(AIBaseException):
    """Raised when ZMQ connection fails."""
    pass

class ZMQTimeoutError(ZMQConnectionError):
    """Raised when ZMQ operation times out."""
    pass
