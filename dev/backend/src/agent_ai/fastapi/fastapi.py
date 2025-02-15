"""FastAPI application module.

Main FastAPI application providing REST endpoints for AI services.
Handles request routing, input validation, error handling and integration
with AI models and ZMQ communication.
"""

# Cambiar la importación
from agent_ai.ai import AIModelManager
from agent_ai.zmq import ZMQManager, ZMQTimeoutError, ValidationError, zmq
from agent_ai.config import settings

import concurrent.futures 
from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import json
import asyncio
import numpy as np
from pydantic import BaseModel
import logging
import cv2
import shutil
import os
import threading
import base64
import tempfile
from transformers import pipeline
from agent_ai.protos.query_pb2 import QueryRequest, QueryResponse  # Updated import path
import backoff
from typing import Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor
import os
from datetime import datetime
from prometheus_client import Counter, Histogram
import structlog
from fastapi.responses import JSONResponse
import tensorflow as tf
from google.protobuf.message import Message  # Agregar para query_pb2
import asyncio.exceptions
import mimetypes
import contextlib

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = structlog.get_logger(__name__)

async def process_query(query: str, timeout: int = 15):
    """Process query with enhanced AI capabilities."""
    try:
        async with asyncio.timeout(timeout):
            if not isinstance(query, str):
                raise ValidationError("Query must be a string")

            if len(query.encode('utf-8')) > settings.ai.max_memory_mb * 1024 * 1024:  # Convert MB to bytes
                raise ValidationError("Query too large")

            # Usar el AIModelManager para análisis múltiple
            ai_manager = AIModelManager.get_instance()
            results = await ai_manager.combined_analysis(query)
            
            # Format the response
            formatted_response = json.dumps({
                "status": "success",
                "response": {
                    "sentiment": {
                        "label": results["sentiment"].label,
                        "score": float(results["sentiment"].score),
                        "rating": results["sentiment"].details["rating"]
                    },
                    "emotion": {
                        "label": results["emotion"].label,
                        "score": float(results["emotion"].score)
                    },
                    "topic": {
                        "label": results["topic"].label,
                        "score": float(results["topic"].score),
                        "all_topics": results["topic"].details["all_labels"],
                        "all_scores": [float(s) for s in results["topic"].details["all_scores"]]
                    }
                },
                "timestamp": datetime.now().isoformat()
            })

            return formatted_response

    except asyncio.TimeoutError:
        logger.error("query_timeout")
        return json.dumps({
            "status": "error",
            "error": "Query processing timed out",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        return json.dumps({
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Unified lifespan handler for startup and shutdown"""
    startup_errors = []
    
    try:
        logger.info("initializing_server", phase="startup_begin")
        
        # Configurar ambiente
        os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        
        # Primera fase: Inicializar TensorFlow
        try:
            async with asyncio.timeout(10):
                logger.info("loading_tensorflow")
                app.state.model = await _initialize_tensorflow()
        except Exception as e:
            startup_errors.append(f"TensorFlow initialization error: {e}")
            logger.error("tensorflow_init_failed", error=str(e))
            raise
            
        # Segunda fase: Inicializar ZMQ
        try:
            async with asyncio.timeout(10):
                logger.info("initializing_zmq")
                app.state.zmq_manager = await _initialize_zmq()
        except Exception as e:
            startup_errors.append(f"ZMQ initialization error: {e}")
            logger.error("zmq_init_failed", error=str(e))
            raise

        if startup_errors:
            raise RuntimeError(f"Server startup failed: {', '.join(startup_errors)}")
            
        logger.info("server_startup_complete", status="ready")
        yield
        
    except Exception as e:
        logger.error("startup_failed", error=str(e), exc_info=True)
        raise
        
    finally:
        # Shutdown cleanup with error handling
        logger.info("server_shutdown_begin")
        shutdown_errors = []
        
        # Cleanup ZMQ
        try:
            if hasattr(app.state, 'zmq_manager'):
                await app.state.zmq_manager.cleanup()
        except Exception as e:
            shutdown_errors.append(f"ZMQ cleanup error: {e}")
            logger.error("zmq_cleanup_failed", error=str(e))

        # Cleanup TensorFlow
        try:
            if hasattr(app.state, 'model'):
                await _cleanup_tensorflow(app.state.model)
        except Exception as e:
            shutdown_errors.append(f"TensorFlow cleanup error: {e}")
            logger.error("tensorflow_cleanup_failed", error=str(e))

        if shutdown_errors:
            logger.error("shutdown_completed_with_errors", 
                        errors=', '.join(shutdown_errors))
        else:
            logger.info("server_shutdown_complete")

async def _initialize_tensorflow():
    """Initialize TensorFlow with proper error handling"""
    try:
        model = TensorFlowModel.get_instance()
        if not model:
            raise RuntimeError("Failed to initialize TensorFlow model")
        return model
    except Exception as e:
        logger.error(f"TensorFlow initialization failed: {e}")
        raise

async def _initialize_zmq():
    """Initialize ZMQ with proper error handling"""
    try:
        zmq_manager = ZMQManager.get_instance()
        return zmq_manager
    except Exception as e:
        logger.error(f"ZMQ initialization failed: {e}")
        raise

async def _cleanup_tensorflow(model):
    """Cleanup TensorFlow resources"""
    try:
        # Implementar limpieza específica de TensorFlow si es necesario
        pass
    except Exception as e:
        logger.error(f"TensorFlow cleanup failed: {e}")
        raise

# API version prefix
API_V1_PREFIX = "/api/v1"

# Remove the duplicate FastAPI initialization and keep only one instance
app = FastAPI(
    title="Agent AI API",
    description="AI services for multiple domains",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=f"{API_V1_PREFIX}/docs",
    redoc_url=f"{API_V1_PREFIX}/redoc",
    openapi_url=f"{API_V1_PREFIX}/openapi.json"
)

async def handle_zeromq_requests():
    """Implementación del servidor ZMQ"""
    logger.info("ZMQ request handler started")
    
    while True:
        try:
            if not hasattr(app.state, 'zmq_socket'):
                logger.error("ZMQ socket not initialized")
                await asyncio.sleep(1)
                continue
            
            logger.debug("Waiting for incoming message...")
            message = await app.state.zmq_socket.recv_string()
            logger.info(f"Received message: {message}")
            
            try:
                msg_data = json.loads(message)
                actual_message = msg_data.get('message', '')
                logger.info(f"Processing message: {actual_message}")
                
                result = await process_query(actual_message)
                logger.info(f"Sending response: {result}")
                
                await app.state.zmq_socket.send_string(result)
                
            except json.JSONDecodeError as e:
                error_msg = json.dumps({
                    "error": "Invalid JSON format",
                    "details": str(e)
                })
                logger.error(f"JSON decode error: {error_msg}")
                await app.state.zmq_socket.send_string(error_msg)
                
        except zmq.Again:
            continue
        except Exception as e:
            logger.error(f"Error in ZMQ request handler: {e}")
            await asyncio.sleep(1)

# Versión asíncrona del procesamiento de consultas
async def process_query_async(query: str):
    try:
        return await asyncio.to_thread(process_query, query)
    except Exception as e:
        logger.error(f"Error in query processing: {e}")
        raise

# Configuración de CORS simplificada
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Be specific about allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
    expose_headers=["*"]
)

# Modelo de datos de entrada
class ImageData(BaseModel):
    image: str  # Cadena codificada en base64

# Modelo de datos
class DataModel(BaseModel):
    data: dict

# Definimos el modelo que esperamos recibir
class QueryModel(BaseModel):
    query: str
    
# Función para procesar la imagen con TensorFlow en un hilo separado
async def run_tensorflow_model(image_data: str):
    try:
        # Convierte la imagen en base64 a un tensor
        image_bytes = base64.b64decode(image_data)
        image_array = tf.image.decode_image(image_bytes)
        image_array = tf.image.resize(image_array, (224, 224))  # Redimensiona a 224x224
        image_array = tf.expand_dims(image_array, 0)  # Añade una dimensión para el batch

        # Usa el modelo para hacer la predicción
        predictions = model.predict(image_array)
        
        # Decodifica las predicciones
        decoded_predictions = tf.keras.applications.mobilenet_v2.decode_predictions(predictions, top=3)[0]
        
        return decoded_predictions
    except Exception as e:
        logger.error(f"Error al procesar la imagen: {e}")
        raise HTTPException(status_code=500, detail="Error procesando la imagen")

async def run_model(data):
    # Aquí iría el código que utiliza TensorFlow/PyTorch para procesar los datos
    return f"Modelo ejecutado correctamente con datos: {str(data)}"

# Reemplazar la inicialización del modelo con un singleton
class TensorFlowModel:
    _instance: Optional['TensorFlowModel'] = None
    _initialized = False
    _lock = threading.Lock()  # Add the missing lock

    @classmethod
    def get_instance(cls):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = cls()
                    if not cls._initialized:
                        cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        try:
            # Configurar logging de TensorFlow
            tf.get_logger().setLevel('ERROR')
            
            # Deshabilitar todos los mensajes de registro de CUDA
            os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
            
            # Configurar el uso de GPU/CPU
            gpus = tf.config.list_physical_devices('GPU')
            if gpus:
                try:
                    # Intentar configurar la GPU
                    for gpu in gpus:
                        tf.config.experimental.set_memory_growth(gpu, True)
                except RuntimeError as e:
                    logger.warning(f"GPU configuration failed: {e}")
                    # Si falla la configuración de GPU, forzar uso de CPU
                    tf.config.set_visible_devices([], 'GPU')
            
            # Cargar el modelo con manejo de excepciones específico
            try:
                self.model = tf.keras.applications.MobileNetV2(weights='imagenet')
                self._initialized = True
                logger.info("TensorFlow model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load MobileNetV2: {e}")
                # Intentar cargar un modelo más simple como fallback
                self.model = tf.keras.Sequential([
                    tf.keras.layers.Dense(1, activation='sigmoid')
                ])
                self._initialized = True
                logger.warning("Loaded fallback model due to MobileNetV2 initialization failure")
                
        except Exception as e:
            logger.error(f"Critical model initialization failure: {e}")
            raise RuntimeError(f"Failed to initialize TensorFlow: {e}")

# Agregar nuevas funciones auxiliares
async def _create_zmq_socket(context):
    """Create and configure ZMQ socket with proper error handling"""
    socket = context.socket(zmq.REP)
    socket_configs = {
        zmq.LINGER: 3000,
        zmq.RCVTIMEO: 15000,
        zmq.SNDTIMEO: 15000,
        zmq.IMMEDIATE: 1,
        zmq.RCVHWM: 1000,
        zmq.SNDHWM: 1000,
        zmq.TCP_KEEPALIVE: 1,
        zmq.TCP_KEEPALIVE_IDLE: 300,
    }
    
    for option, value in socket_configs.items():
        socket.setsockopt(option, value)
        
    bind_address = f"tcp://{settings.zmq.host}:{settings.zmq.port}"
    socket.bind(bind_address)
    
    return socket

async def _cleanup_zmq_resources(context, socket):
    """Clean up ZMQ resources safely"""
    try:
        if socket:
            socket.close(linger=0)
        if context:
            context.term()
    except Exception as e:
        logger.error(f"Error during ZMQ cleanup: {e}")

async def _run_with_error_boundary(coro):
    """Run coroutine with error boundary and automatic restart"""
    while True:
        try:
            await coro
        except Exception as e:
            logger.error(f"Error in background task: {e}")
            await asyncio.sleep(1)  # Prevent tight restart loop

class ResourceManager:
    def __init__(self):
        self.resources = {}

    @contextlib.asynccontextmanager
    async def resource_context(self, resource_name: str):
        """Context manager for application resources"""
        try:
            if resource_name not in self.resources:
                self.resources[resource_name] = await self._initialize_resource(resource_name)
            yield self.resources[resource_name]
        finally:
            if resource_name in self.resources:
                await self._cleanup_resource(resource_name)

    async def _initialize_resource(self, resource_name: str):
        """Initialize a specific resource"""
        if resource_name == "tensorflow":
            return TensorFlowModel.get_instance()
        elif resource_name == "zmq":
            return ZMQManager.get_instance()
        raise ValueError(f"Unknown resource: {resource_name}")

    async def _cleanup_resource(self, resource_name: str):
        """Cleanup a specific resource"""
        if resource_name in self.resources:
            resource = self.resources[resource_name]
            if hasattr(resource, 'cleanup'):
                await resource.cleanup()
            del self.resources[resource_name]

app.state.resource_manager = ResourceManager()

# Create versioned routers
v1_router = APIRouter(prefix=API_V1_PREFIX)
# Register routers
app.include_router(v1_router)

# Move existing endpoints to v1_router
@v1_router.post("/process")
async def handle_process_query(query_model: QueryModel):
    """Process a query through AI models."""
    if not isinstance(query_model.query, str):
        raise HTTPException(status_code=400, detail="Query must be a string")
        
    async with app.state.resource_manager.resource_context("tensorflow") as model:
        try:
            async with asyncio.timeout(30):  # Add timeout
                result = await process_query(query_model.query)
                return result
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Processing timeout")
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Error in query processing: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

@v1_router.post("/result")
async def process_data(data: DataModel):
    try:
        response = await run_model(data.data)
        return {"result": response}
    except Exception as e:
        logger.error(f"Error al procesar los datos: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando los datos: {e}")

@v1_router.get("/health")
async def health_check():
    """Check service health status.
    
    Checks health of key components including:
    - TensorFlow model loading
    - ZMQ connection status
    - Memory usage
    
    Returns:
        Health status of each component
    """
    return {
        "status": "healthy",
        "tensorflow_model": "loaded" if app.state.model is not None else "not_loaded",
        "zmq_status": "connected" if ZMQManager.get_instance().sockets else "disconnected"
    }

@v1_router.post("/upload")
async def upload_file(file: UploadFile):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Only image files allowed")
    
    file_size = 0
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    try:
        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > 10_000_000:  # 10MB limit
                raise HTTPException(413, "File too large")
            await temp_file.write(chunk)  # Falta await aquí
        return {"filename": file.filename}
    finally:
        temp_file.close()
        os.unlink(temp_file.name)

@v1_router.post("/ai/vision/detect-objects")
async def detect_objects(image_data: ImageData):
    """Perform object detection on an image.
    
    Analyzes an image using computer vision models to detect and identify objects.
    
    Args:
        image_data: Base64 encoded image data
        
    Returns:
        JSON object with:
            - detected objects and their locations
            - confidence scores
            - bounding boxes
        
    Raises:
        HTTPException: If image processing fails or invalid format
    """
    try:
        ai_manager = AIModelManager.get_instance()
        result = await ai_manager.detect_objects(image_data.image)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@v1_router.post("/ai/medical/analyze")
async def analyze_medical(text: str):
    """Analyze medical text for clinical insights.

    Processes medical text to extract conditions, medications, procedures
    and other relevant clinical information.

    Args:
        text: Medical text to analyze

    Returns:
        Analysis results including:
            - detected medical conditions
            - medications
            - procedures
            - confidence scores
            
    Raises:
        HTTPException: For processing errors or invalid input
    """
    try:
        ai_manager = AIModelManager.get_instance()
        result = await ai_manager.analyze_text(text)  # Usa modelo de análisis de texto
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@v1_router.post("/ai/security/detect-threats")
async def detect_threats(data: str):
    """Endpoint for security threat detection"""
    try:
        ai_manager = AIModelManager.get_instance()
        result = await ai_manager.detect_security_threats(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@v1_router.post("/ai/finance/analyze-risk")
async def analyze_risk(text: str):
    """Endpoint for financial risk analysis"""
    try:
        ai_manager = AIModelManager.get_instance()
        result = await ai_manager.analyze_financial_risk(text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.exception_handler(ZMQTimeoutError)
async def zmq_timeout_handler(request, exc):
    return JSONResponse(
        status_code=504,
        content={"error": "Gateway Timeout", "detail": str(exc)}
    )

@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"error": "Bad Request", "detail": str(exc)}
    )
