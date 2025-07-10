# System-Specific Anomaly Endpoints - cURL Examples

## Overview
These endpoints allow you to retrieve anomalies and count anomalies by system/unit ID from MongoDB collections.

## Authentication
All endpoints require JWT authentication. Replace `YOUR_TOKEN_HERE` with a valid JWT token.

## Endpoints

### 1. Get Anomalies by System
Retrieves anomalies from a specific system collection with pagination support.

**URL:** `GET /api/anomalies/system/{unit_id}/`

**Parameters:**
- `limit` (optional): Number of documents to return (default: 100, max: 1000)
- `skip` (optional): Number of documents to skip (default: 0)

#### Examples:

```bash
# Get first 10 anomalies from system 1
curl -X GET "http://localhost:8000/api/anomalies/system/1/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Get 5 anomalies from system 2, skipping first 10
curl -X GET "http://localhost:8000/api/anomalies/system/2/?limit=5&skip=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Get all anomalies from system 3 (up to 1000)
curl -X GET "http://localhost:8000/api/anomalies/system/3/?limit=1000" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Response Format:**
```json
{
  "success": true,
  "unit_id": "1",
  "anomalies": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "description": "Sample anomaly",
      "criticality": 2,
      "status": "pending",
      "imported_at": "2024-01-01T12:00:00Z",
      "source": "excel_import"
    }
  ],
  "count": 1,
  "limit": 10,
  "skip": 0,
  "message": "Retrieved 1 anomalies from system 1"
}
```

### 2. Count Anomalies by System
Returns the total count of anomalies in a specific system collection.

**URL:** `GET /api/anomalies/system/{unit_id}/count/`

#### Examples:

```bash
# Count anomalies in system 1
curl -X GET "http://localhost:8000/api/anomalies/system/1/count/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Count anomalies in system 2
curl -X GET "http://localhost:8000/api/anomalies/system/2/count/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Response Format:**
```json
{
  "success": true,
  "unit_id": "1",
  "count": 150,
  "message": "Found 150 anomalies in system 1"
}
```

## Error Responses

### Authentication Error (401)
```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [
    {
      "token_class": "AccessToken",
      "token_type": "access",
      "message": "Token is expired"
    }
  ]
}
```

### Invalid Parameters (400)
```json
{
  "success": false,
  "error": "Invalid query parameters. limit and skip must be integers."
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Error message here"
}
```

## How to Get a Valid Token

1. **Login to get a token:**
```bash
curl -X POST "http://localhost:8000/api/users/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

2. **Extract the access token from the response:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

3. **Use the access token in your requests:**
```bash
curl -X GET "http://localhost:8000/api/anomalies/system/1/" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Notes

- System collections are named `unit_{unit_id}` in MongoDB
- The `unit_id` parameter is converted to a safe collection name
- Empty or non-existent system collections will return 0 anomalies
- Maximum limit is 1000 for performance reasons
- All responses include success status and descriptive messages 