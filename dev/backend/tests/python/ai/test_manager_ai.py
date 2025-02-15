import pytest
from agent_ai.ai import AIModelManager
from agent_ai.config import Config

import torch

@pytest.fixture
async def ai_manager():
    manager = AIModelManager.get_instance()
    yield manager
    await manager.cleanup_models()

@pytest.mark.asyncio
async def test_sentiment_analysis():
    manager = AIModelManager.get_instance()
    result = await manager.analyze_sentiment("This is a great movie!")
    assert isinstance(result, AIResponse)
    assert result.label in ["very positive", "positive", "neutral", "negative", "very negative"]
    assert 0 <= result.score <= 1

@pytest.mark.asyncio
async def test_emotion_detection():
    manager = AIModelManager.get_instance()
    result = await manager.analyze_emotion("I am so happy today!")
    assert isinstance(result, AIResponse)
    assert result.label is not None
    assert 0 <= result.score <= 1

@pytest.mark.asyncio
async def test_topic_classification():
    manager = AIModelManager.get_instance()
    topics = ["technology", "sports", "politics"]
    result = await manager.classify_topic("The new iPhone was announced today", topics)
    assert isinstance(result, AIResponse)
    assert result.label in topics
    assert 0 <= result.score <= 1

@pytest.mark.asyncio
async def test_gpu_memory_cleanup():
    if torch.cuda.is_available():
        manager = AIModelManager.get_instance()
        initial_memory = torch.cuda.memory_allocated()
        await manager.analyze_sentiment("Test text")
        manager._cleanup_gpu_memory()
        final_memory = torch.cuda.memory_allocated()
        assert final_memory <= initial_memory

@pytest.mark.asyncio
async def test_model_context():
    manager = AIModelManager.get_instance()
    async with manager.model_context('sentiment') as model:
        assert model is not None
        assert model in manager.models.values()

@pytest.mark.asyncio
async def test_input_validation():
    """Test input validation"""
    manager = AIModelManager.get_instance()
    with pytest.raises(ValueError):
        await manager.analyze_sentiment("")
    with pytest.raises(ValueError):
        await manager.analyze_sentiment("a" * (manager.MAX_TEXT_LENGTH + 1))

@pytest.mark.asyncio
async def test_model_timeout():
    """Test model timeout handling"""
    manager = AIModelManager.get_instance()
    with patch('asyncio.sleep', side_effect=asyncio.TimeoutError):
        with pytest.raises(RuntimeError):
            await manager.analyze_sentiment("test")

@pytest.mark.asyncio
async def test_combined_analysis():
    """Test combined analysis functionality"""
    manager = AIModelManager.get_instance()
    text = "Apple announces new iPhone with AI features"
    result = await manager.combined_analysis(text)
    
    assert "sentiment" in result
    assert "emotion" in result
    assert "topic" in result
    assert "entities" in result
    
    assert isinstance(result["sentiment"], AIResponse)
    assert isinstance(result["emotion"], AIResponse)
    assert isinstance(result["topic"], AIResponse)
    assert isinstance(result["entities"], AIResponse)

@pytest.mark.asyncio
async def test_entity_extraction():
    """Test named entity recognition"""
    manager = AIModelManager.get_instance()
    text = "Microsoft CEO Satya Nadella announced new AI features"
    result = await manager.extract_entities(text)
    
    assert result.label == "entities"
    assert result.score > 0
    assert result.details is not None
    
    entities = result.details
    assert any("Microsoft" in str(entity["word"]) for entity in entities.get("ORG", []))
    assert any("Satya Nadella" in str(entity["word"]) for entity in entities.get("PER", []))

@pytest.mark.asyncio
async def test_question_answering():
    """Test question answering capability"""
    manager = AIModelManager.get_instance()
    context = "The quick brown fox jumps over the lazy dog"
    question = "What animal jumps?"
    
    result = await manager.answer_question(context, question)
    assert result.label.lower() == "fox"
    assert result.score > 0
    assert "start" in result.details
    assert "end" in result.details

@pytest.mark.asyncio
async def test_model_context_error_handling():
    """Test model context error handling"""
    manager = AIModelManager.get_instance()
    with pytest.raises(RuntimeError):
        async with manager.model_context("nonexistent_model"):
            pass

@pytest.mark.asyncio
async def test_gpu_memory_management():
    """Test GPU memory management"""
    if not torch.cuda.is_available():
        pytest.skip("GPU not available")
        
    manager = AIModelManager.get_instance()
    initial_memory = torch.cuda.memory_allocated()
    
    # Force memory allocation
    async with manager.model_context("sentiment"):
        peak_memory = torch.cuda.memory_allocated()
        assert peak_memory > initial_memory
    
    # Check memory cleanup
    final_memory = torch.cuda.memory_allocated()
    assert final_memory < peak_memory
