"""ZMQ communication manager module.

This module handles all ZeroMQ communication including:
- Connection management
- Message sending/receiving
- Error handling and retries
- Circuit breaking for fault tolerance
"""

from agent_ai.logging import get_logger
import structlog
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import backoff
from agent_ai.config import settings, LATENCY, REQUESTS, FAILURES, POOL_MAX_WORKERS
import threading
import contextlib

import zmq
import zmq.asyncio
from agent_ai.core.exceptions import ZMQConnectionError, ZMQTimeoutError, ValidationError

# Configure logger
logger = get_logger(__name__)

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 30):
        self.logger = get_logger(self.__class__.__name__)
        if failure_threshold <= 0:
            raise ValueError("failure_threshold must be positive")
        if reset_timeout <= 0:
            raise ValueError("reset_timeout must be positive")
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.last_failure_time = None
        self.is_open = False

    def allow_request(self) -> bool:
        if not self.is_open:
            return True
            
        if (datetime.now() - self.last_failure_time).seconds > self.reset_timeout:
            self.reset()
            return True
        return False

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        if self.failure_count >= self.failure_threshold:
            self.is_open = True

    def record_success(self):
        self.reset()

    def reset(self):
        self.failure_count = 0
        self.is_open = False
        self.last_failure_time = None

class ZMQManager:
    """Manages ZMQ connections and communication.
    
    Handles connection pooling, automatic reconnection, circuit breaking,
    and message routing. Implements singleton pattern for application-wide
    connection management.
    
    Attributes:
        context: ZMQ context for creating sockets
        sockets: Dictionary mapping addresses to socket connections
        circuit_breaker: Circuit breaker for fault tolerance
        executor: Thread pool executor for async operations

    Example:
        manager = ZMQManager.get_instance()
        async with manager.socket_context(zmq.REQ, "tcp://localhost:5555") as socket:
            await socket.send_string("Hello")
            response = await socket.recv_string()
    """
    
    _instance: Optional['ZMQManager'] = None
    
    def __init__(self):
        self.context = None
        self.sockets = {}
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=settings.ai.failure_threshold,
            reset_timeout=settings.ai.reset_timeout_sec
        )
        self.executor = ThreadPoolExecutor(
            max_workers=POOL_MAX_WORKERS, 
            thread_name_prefix="zmq_worker"
        )
        self._shutdown_event = asyncio.Event()
        self._active_connections = set()
        self._conn_lock = asyncio.Lock()
        self._initialize_context()
        self.max_reconnect_attempts = 3
        self.reconnect_delay = 1.0
    
    def _initialize_context(self):
        if self.context is None:
            try:
                zmq.asyncio.install()  # Enable asyncio integration
                self.context = zmq.asyncio.Context()
                logger.info("ZMQ asyncio context initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize ZMQ context: {e}")
                # Cambiar a excepción específica del dominio
                raise ZMQConnectionError(f"Failed to initialize ZMQ context: {e}") from e
        
    @classmethod
    def get_instance(cls) -> 'ZMQManager':
        if cls._instance is None:
            cls._instance = ZMQManager()
        return cls._instance
    
    @contextlib.asynccontextmanager
    async def socket_context(self, socket_type: int, address: str):
        """Context manager for ZMQ socket operations"""
        socket = None
        try:
            socket = await self.get_socket(socket_type, address)
            yield socket
        finally:
            if socket:
                await self._close_socket(socket, address)

    @contextlib.asynccontextmanager
    async def connection_context(self):
        """Context manager for ZMQ connections"""
        try:
            yield self
        finally:
            await self.cleanup()

    @LATENCY.time()
    async def send_recv(self, socket: zmq.Socket, data: str) -> str:
        """Send data and receive response through ZMQ socket.
        
        Handles sending a string message and receiving a response with proper
        error handling, timeout management and metric tracking.
        
        Args:
            socket: Connected ZMQ socket
            data: String data to send
            
        Returns:
            Response string from server
            
        Raises:
            ZMQTimeoutError: If socket times out during operation
            ValidationError: If data format is invalid
            ZMQConnectionError: If connection fails
        """
        async with self.socket_context(zmq.REQ, settings.zmq) as socket:
            REQUESTS.inc()
            start_time = datetime.now()
            
            try:
                if not isinstance(data, str):
                    raise ValidationError("Data must be string")

                log = logger.bind(
                    operation="send_recv",
                    data_length=len(data),
                    start_time=start_time
                )
                
                await socket.send_string(data)
                response = await socket.recv_string()
                
                log.info("request_successful", 
                        duration=(datetime.now() - start_time).total_seconds())
                return response

            except zmq.Again:
                FAILURES.inc()
                self.circuit_breaker.record_failure()
                raise ZMQTimeoutError("Socket timeout")
                
            except Exception as e:
                FAILURES.inc()
                self.circuit_breaker.record_failure()
                logger.exception("request_failed", 
                               error=str(e),
                               duration=(datetime.now() - start_time).total_seconds())
                raise

    @backoff.on_exception(backoff.expo, 
                         (zmq.ZMQError, ZMQConnectionError),
                         max_tries=settings.ai.max_retries)
    async def get_socket(self, socket_type: int, address: str) -> zmq.Socket:
        """Get or create a socket connection.
        
        Creates new socket if needed or returns existing connection from pool.
        Handles connection backoff/retry and circuit breaking.

        Args:
            socket_type: ZMQ socket type (REQ, REP, etc)
            address: Socket address to connect to

        Returns:
            Connected ZMQ socket
            
        Raises:
            ZMQConnectionError: If connection fails after retries
        """
        reconnect_attempts = 0
        while reconnect_attempts < self.max_reconnect_attempts:
            try:
                if not self.circuit_breaker.allow_request():
                    logger.warning("circuit_breaker_open")
                    raise ZMQConnectionError("Circuit breaker is open")

                async with self._conn_lock:
                    try:
                        if address not in self.sockets or self.sockets[address].closed:
                            socket = await self._create_new_socket(socket_type, address)
                            self.sockets[address] = socket
                            self._active_connections.add(address)
                            logger.info("socket_created", endpoint=address)

                        return self.sockets[address]

                    except Exception as e:
                        logger.exception("socket_creation_failed", error=str(e))
                        self.circuit_breaker.record_failure()
                        if address in self._active_connections:
                            self._active_connections.remove(address)
                        raise ZMQConnectionError(f"Failed to create socket: {str(e)}")
            except Exception as e:
                reconnect_attempts += 1
                if reconnect_attempts >= self.max_reconnect_attempts:
                    raise
                await asyncio.sleep(self.reconnect_delay * reconnect_attempts)

    async def _create_new_socket(self, socket_type: int, address: str):
        socket = None
        try:
            socket = self.context.socket(socket_type)
            socket.setsockopt(zmq.LINGER, 0)
            socket.setsockopt(zmq.RCVTIMEO, settings.zmq.recv_timeout_ms)
            socket.setsockopt(zmq.SNDTIMEO, settings.zmq.send_timeout_ms)
            
            endpoint = f"tcp://{settings.zmq.host}:{settings.zmq.port}"
            if socket_type == zmq.REP:
                socket.bind(endpoint)
            else:
                socket.connect(endpoint)
            
            return socket
        except Exception as e:
            if socket:
                socket.close(linger=0)
            raise ZMQConnectionError(f"Failed to create socket: {e}")

    async def cleanup(self):
        """Improved cleanup method with proper resource management"""
        logger.info("Starting ZMQ cleanup")
        cleanup_errors = []
        self._shutdown_event.set()
        
        try:
            # Primera fase: Cerrar sockets activos
            async with self._conn_lock:
                for address in list(self._active_connections):
                    try:
                        if address in self.sockets:
                            await self._close_socket(self.sockets[address], address)
                    except Exception as e:
                        cleanup_errors.append(f"Socket {address} closure error: {e}")
                        logger.error(f"Error closing socket {address}: {e}")
            
            # Segunda fase: Limpiar recursos del contexto
            try:
                if self.context:
                    try:
                        self.context.term()
                    except Exception as e:
                        cleanup_errors.append(f"Context termination error: {e}")
                    finally:
                        self.context = None
            except Exception as e:
                cleanup_errors.append(f"Context cleanup error: {e}")
            
            # Tercera fase: Limpiar executor
            try:
                if hasattr(self, 'executor'):
                    self.executor.shutdown(wait=True, cancel_futures=True)
            except Exception as e:
                cleanup_errors.append(f"Executor shutdown error: {e}")
            
            # Limpiar colecciones
            self._active_connections.clear()
            self.sockets.clear()
            
            if cleanup_errors:
                logger.warning(f"ZMQ cleanup completed with errors: {', '.join(cleanup_errors)}")
            else:
                logger.info("ZMQ cleanup completed successfully")
                
        except Exception as e:
            logger.error(f"Critical error during cleanup: {e}")
            raise RuntimeError(f"Failed to cleanup ZMQ resources: {e}, Previous errors: {cleanup_errors}")

    async def _close_socket(self, socket, address):
        """Cierre seguro de socket"""
        try:
            if not socket.closed:
                socket.setsockopt(zmq.LINGER, 0)
                socket.close(linger=0)
                await asyncio.sleep(0.1)  # Dar tiempo para el cierre
                logger.info(f"Socket closed: {address}")
        except Exception as e:
            logger.error(f"Error in socket closure: {e}")

    async def reconnect(self, address: str):
        """Enhanced reconnection handling"""
        async with self._conn_lock:
            try:
                if address in self.sockets:
                    await self._close_socket(self.sockets[address], address)
                    del self.sockets[address]
                if address in self._active_connections:
                    self._active_connections.remove(address)
                    
                socket = await self.get_socket(zmq.REQ, address)
                return socket
            except Exception as e:
                logger.error(f"Reconnection failed: {e}")
                raise ZMQConnectionError("Failed to reconnect")

    def __del__(self):
        """Enhanced destructor with proper resource cleanup"""
        try:
            # Cleanup any running tasks first
            if hasattr(self, '_shutdown_event'):
                self._shutdown_event.set()
            
            # Close all active connections
            if hasattr(self, '_active_connections'):
                for address in list(self._active_connections):
                    try:
                        self._close_socket(self.sockets[address], address)
                    except Exception as e:
                        logger.error(f"Error closing socket {address}: {e}")
            
            # Clear all sockets
            if hasattr(self, 'sockets'):
                for socket in self.sockets.values():
                    try:
                        socket.close(linger=0)
                    except Exception as e:
                        logger.error(f"Error closing socket: {e}")
                self.sockets.clear()
            
            # Terminate context if it exists
            if hasattr(self, 'context') and self.context:
                try:
                    self.context.term()
                except Exception as e:
                    logger.error(f"Error terminating context: {e}")
            
            # Clear all instance variables
            for attr in list(self.__dict__.keys()):
                try:
                    delattr(self, attr)
                except Exception as e:
                    logger.error(f"Error deleting attribute {attr}: {e}")
                    
        except Exception as e:
            logger.error(f"Error in ZMQManager destructor: {e}")
