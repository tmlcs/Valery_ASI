
# Agent AI API Documentation

## Overview
Agent AI provides a RESTful API for accessing AI capabilities across multiple domains including vision, medical, security and financial analysis.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
API requests require authentication using Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Process Query
Process text through AI models for analysis.

**POST** `/process`

Request:
```json
{
  "query": "Text to analyze"
}
```

Response:
```json
{
  "status": "success", 
  "response": {
    "sentiment": {
      "label": "positive",
      "score": 0.92,
      "rating": 4
    },
    "emotion": {
      "label": "joy",
      "score": 0.85  
    },
    "topic": {
      "label": "technology",
      "score": 0.78,
      "all_topics": ["technology", "business", "science"],
      "all_scores": [0.78, 0.15, 0.07]
    }
  },
  "timestamp": "2024-01-28T15:23:12Z"
}
```

### Vision Analysis
Analyze images for object detection.

**POST** `/ai/vision/detect-objects`

Request:
```json
{
  "image": "base64_encoded_image_data"
}
```

Response:
```json
{
  "objects": [
    {
      "label": "person",
      "confidence": 0.95,
      "bbox": [10, 20, 100, 200]
    }
  ]
}
```

### Medical Analysis 
Analyze medical text.

**POST** `/ai/medical/analyze`

Request body: Medical text content

Response:
```json
{
  "conditions": [],
  "medications": [],
  "procedures": [],
  "confidence": 0.89
}
```

### Security Analysis
Detect potential security threats.

**POST** `/ai/security/detect-threats`

Request body: Content to analyze

Response:
```json
{
  "threats": [],
  "risk_level": "low",
  "confidence": 0.92
}
```

### Financial Analysis
Analyze financial risk.

**POST** `/ai/finance/analyze-risk`

Request body: Financial text/data

Response:
```json
{
  "risk_score": 65,
  "factors": [],
  "recommendations": []  
}
```

## Error Handling

The API uses standard HTTP response codes:

- 200: Success
- 400: Bad Request 
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error
- 504: Gateway Timeout

Error response format:
```json
{
  "error": "Error type",
  "detail": "Error description",
  "timestamp": "2024-01-28T15:23:12Z"
}
```

## Rate Limiting
- Maximum 100 requests per minute per IP
- Exceeded limits return 429 status code

## Versioning
API versioning uses URI prefix `/api/v{version_number}`
