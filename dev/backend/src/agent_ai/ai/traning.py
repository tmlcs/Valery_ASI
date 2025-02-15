from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import torch.nn as nn

@dataclass
class TrainingConfig:
    model_name: str
    batch_size: int
    learning_rate: float
    epochs: int
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Field validations
    def __post_init__(self):
        if self.batch_size < 1:
            # Cambiar a excepción específica de validación
            raise ValidationError("Batch size must be positive")
        if self.learning_rate <= 0:
            raise ValidationError("Learning rate must be positive")
        if self.epochs < 1:
            raise ValidationError("Epochs must be positive")

@dataclass
class ModelConfig:
    """Configuration for different AI model types"""
    
    COMPUTER_VISION = {
        "object_detection": "facebook/detr-resnet-50",
        "face_recognition": "deepface/vgg-face",
        "image_segmentation": "facebook/mask2former-swin-large-ade",
    }
    
    NLP = {
        "sentiment": "nlptown/bert-base-multilingual-uncased-sentiment",
        "translation": "Helsinki-NLP/opus-mt-en-es",
        "chatbot": "facebook/blenderbot-400M-distill",
    }
    
    FINANCIAL = {
        "risk_analysis": "ProsusAI/finbert",
        "fraud_detection": "microsoft/BiomedNLP-PubMedBERT-base-uncased",
    }
    
    MEDICAL = {
        "disease_classification": "microsoft/BiomedNLP-PubMedBERT-base",
        "medical_qa": "samwalrus/medbert_base_uncased",
    }
    
    SECURITY = {
        "threat_detection": "deepset/roberta-base-squad2",
        "malware_analysis": "microsoft/codebert-base",
    }
    
    ROBOTICS = {
        "motion_planning": "nvidia/mit-b0",
        "object_manipulation": "google/vit-base-patch16-224",
    }

class ModelTrainer:
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.model = None
        self.optimizer = None
        
    def setup_model(self, model_type: str):
        """Initialize model based on type"""
        if model_type not in ModelConfig.__dict__:
            raise ValueError(f"Unknown model type: {model_type}")
            
        model_configs = getattr(ModelConfig, model_type)
        # Model initialization logic here
        
    def train_epoch(self, data_loader):
        """Train model for one epoch"""
        # Training logic here
        pass
        
    def evaluate(self, data_loader):
        """Evaluate model performance"""
        # Evaluation logic here
        pass
