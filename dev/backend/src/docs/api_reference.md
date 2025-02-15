# Agent AI API Reference

## Overview

The Agent AI API provides enterprise-grade artificial intelligence capabilities through a RESTful interface. Our API offers:

- Natural Language Processing
- Computer Vision
- Medical Text Analysis
- Security Threat Detection
- Financial Risk Analysis

## Base URL

All API endpoints are prefixed with `/api/v1/`.

## Authentication

Authentication uses API keys with role-based access control. Include your API key in the request header:

```http
Authorization: Bearer your-api-key-here
```

## Endpoints

### Health Check

```http
GET /api/v1/health
```

Checks the health status of the service.

**Response**
```json
{
  "status": "healthy",
  "tensorflow_model": "loaded",
  "zmq_status": "connected"
}
```

### Process Query

```http
POST /api/v1/process
```

Analyzes text for sentiment, emotion, and topic classification.

**Request Body**
```json
{
  "query": "This product is amazing! I love how intuitive it is."
}
```

**Response**
```json
{
  "status": "success",
  "response": {
    "sentiment": {
      "label": "positive",
      "score": 0.95,
      "rating": 4.5
    },
    "emotion": {
      "label": "joy",
      "score": 0.87
    },
    "topic": {
      "label": "product_review",
      "score": 0.92,
      "all_topics": ["product_review", "customer_feedback"],
      "all_scores": [0.92, 0.85]
    }
  },
  "timestamp": "2024-01-20T15:30:45.123Z"
}
```

### Object Detection

```http
POST /api/v1/ai/vision/detect-objects
```

Detects and identifies objects in images.

**Request Body**
```json
{
  "image": "base64_encoded_image_data"
}
```

**Response**
```json
{
  "objects": [
    {
      "label": "person",
      "confidence": 0.98,
      "bbox": [10, 20, 100, 200]
    },
    {
      "label": "car",
      "confidence": 0.95,
      "bbox": [150, 30, 300, 180]
    }
  ]
}
```

### Medical Text Analysis

```http
POST /api/v1/ai/medical/analyze
```

Analyzes medical text for clinical insights.

**Request Body**
```json
{
  "text": "Patient presents with severe headache and nausea for 3 days."
}
```

**Response**
```json
{
  "conditions": [
    {
      "name": "headache",
      "confidence": 0.94,
      "severity": "severe"
    },
    {
      "name": "nausea",
      "confidence": 0.89
    }
  ],
  "duration": "3 days",
  "recommendations": [
    "Further neurological examination",
    "Monitor symptoms"
  ]
}
```

## Error Handling

The API uses standard HTTP status codes and provides detailed error messages:

```json
{
  "error": "ValidationError",
  "detail": "Query text exceeds maximum length",
  "status_code": 400
}
```

Common status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error
- 504: Gateway Timeout

## Rate Limits

- 100 requests per minute per API key
- 1000 requests per hour per API key
- Maximum query length: 2000 characters
- Maximum image size: 10MB

## Best Practices

1. **Error Handling**: Always implement proper error handling in your client code.
2. **Timeouts**: Set appropriate timeouts (recommended: 30 seconds).
3. **Retries**: Implement exponential backoff for failed requests.
4. **Caching**: Cache responses when appropriate to reduce API calls.

## SDK Examples

### Python

```python
from agent_ai import AgentAI

client = AgentAI(api_key="your-api-key")

# Analyze text
result = client.process_query("This product is amazing!")
print(result.sentiment.label)  # "positive"

# Detect objects in image
with open("image.jpg", "rb") as f:
    result = client.detect_objects(f)
    for obj in result.objects:
        print(f"Found {obj.label} with confidence {obj.confidence}")
```

### JavaScript

```javascript
import { AgentAI } from '@agent-ai/sdk';

const client = new AgentAI('your-api-key');

// Analyze text
const result = await client.processQuery('This product is amazing!');
console.log(result.sentiment.label);  // "positive"

// Detect objects in image
const imageFile = document.querySelector('input[type="file"]').files[0];
const result = await client.detectObjects(imageFile);
result.objects.forEach(obj => {
  console.log(`Found ${obj.label} with confidence ${obj.confidence}`);
});
```

## Versioning

The API uses semantic versioning. The current version is v1.0.0.

Breaking changes will be announced at least 6 months in advance.
