# API Reference
**Hokku Training Simulation**

## 🚀 Base URL
```
Local Development: http://localhost:3000/api
```

## 🔐 Authentication
- **Supabase Auth**: User authentication via JWT tokens
- **Service Role**: Admin operations use service role key
- **ElevenLabs**: API key with `convai_write` permissions

---

## 🧠 ElevenLabs Integration APIs

### Generate Conversation Token
```http
GET /api/elevenlabs-token?agentId={agentId}&trainingMode={mode}&knowledgeContext={context}
```

**Parameters:**
- `agentId` (required): ElevenLabs agent ID (e.g., `agent_5101k5ksv08newj9b4aa2wt282hv`)
- `trainingMode` (optional): theory | practice | simulation
- `knowledgeContext` (optional): URL-encoded knowledge context

**Response:**
```json
{
  "token": "jwt_token_here",
  "expires_in": 3600
}
```

**Status Codes:**
- `200` - Success: Token generated
- `401` - Error: Invalid ElevenLabs API key or missing permissions
- `405` - Error: Method not allowed (use GET only)

**Current Agent:**
- **Active Agent**: `agent_5101k5ksv08newj9b4aa2wt282hv`
- **Dashboard**: Configured with dynamic variables
- **Variables**: `{{training_mode}}`, `{{knowledge_context}}`, `{{examiner_instructions}}`

### Load Scenario Knowledge
```http
POST /api/scenario-knowledge
```

**Request Body:**
```json
{
  "scenario_id": "demo-scenario-1",
  "company_id": "01f773e2-1027-490e-8d36-279136700bbf"
}
```

**Response:**
```json
{
  "success": true,
  "context": "Knowledge context string (1629 chars)",
  "documents": 2,
  "language": "en"
}
```

**Status Codes:**
- `200` - Success: Knowledge loaded
- `400` - Error: Missing required parameters
- `404` - Error: Scenario not found

---

## 📚 Training System APIs

### Get Employee Assignments
```http
GET /api/track-assignments?employee_id={employeeId}
```

**Parameters:**
- `employee_id` (required): Employee UUID

**Response:**
```json
[
  {
    "id": "demo-assignment-1758312913428-7qtmmsq",
    "employee_id": "f68046c7-e78d-4793-909f-61a6f6587485",
    "track_id": "0fcafa44-eb6b-42e5-bcc3-7b89d224cfe7",
    "status": "assigned",
    "progress_percentage": 0,
    "created_at": "2025-09-19T20:15:13.428Z"
  }
]
```

### Get Assignment Details
```http
GET /api/track-assignments/{assignmentId}
```

**Response:**
```json
{
  "id": "demo-assignment-1758312913428-7qtmmsq",
  "employee_id": "f68046c7-e78d-4793-909f-61a6f6587485",
  "track_id": "0fcafa44-eb6b-42e5-bcc3-7b89d224cfe7",
  "status": "assigned",
  "progress_percentage": 0,
  "track": {
    "name": "Coffee Service Training",
    "description": "Learn coffee preparation and service"
  }
}
```

### Update Assignment Progress
```http
POST /api/track-assignments/{assignmentId}/progress
```

**Request Body:**
```json
{
  "progress_percentage": 75,
  "notes": "Completed theory section"
}
```

---

## 📖 Knowledge Base APIs

### Get Documents
```http
GET /api/knowledge-base/documents?company_id={companyId}&category_id={categoryId}
```

**Parameters:**
- `company_id` (required): Company UUID
- `category_id` (optional): Filter by category

**Response:**
```json
[
  {
    "id": "doc-uuid",
    "title": "Coffee Menu",
    "content": "Espresso, Cappuccino (250/350/450 ml)...",
    "category_id": "cat-uuid",
    "language": "en",
    "created_at": "2025-09-19T20:15:13.428Z"
  }
]
```

### Create Document
```http
POST /api/knowledge-base/documents
```

**Request Body:**
```json
{
  "title": "New Training Document",
  "content": "Document content...",
  "category_id": "category-uuid",
  "company_id": "company-uuid",
  "language": "en"
}
```

### Get Categories
```http
GET /api/knowledge-base/categories?company_id={companyId}
```

**Response:**
```json
[
  {
    "id": "cat-uuid",
    "name": "Menu Items",
    "description": "Coffee and food menu",
    "company_id": "company-uuid"
  }
]
```

---

## 🔄 Translation APIs

### Translate Content
```http
POST /api/translate
```

**Request Body:**
```json
{
  "text": "Hello world",
  "target_language": "ru",
  "source_language": "en"
}
```

**Response:**
```json
{
  "translated_text": "Привет мир",
  "source_language": "en",
  "target_language": "ru"
}
```

### Translate Scenario
```http
POST /api/scenarios/{scenarioId}/translate
```

**Request Body:**
```json
{
  "target_language": "ru"
}
```

---

## 👥 User Management APIs

### Get Employees
```http
GET /api/employees?company_id={companyId}
```

**Response:**
```json
[
  {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee"
  }
]
```

### Sync Users
```http
POST /api/sync-users
```

**Purpose**: Synchronize auth.users with application users table

---

## 📊 Training Sessions APIs

### Create Avatar Session
```http
POST /api/avatar-sessions
```

**Request Body:**
```json
{
  "assignment_id": "assignment-uuid",
  "scenario_id": "scenario-uuid",
  "language": "en"
}
```

### Get Session Transcript
```http
GET /api/avatar-sessions/{sessionId}/transcript
```

**Response:**
```json
{
  "session_id": "session-uuid",
  "transcript": [
    {
      "timestamp": "2025-09-19T20:15:13.428Z",
      "speaker": "user",
      "text": "What sizes of cappuccino do you have?"
    },
    {
      "timestamp": "2025-09-19T20:15:15.428Z",
      "speaker": "ai",
      "text": "We have cappuccino in 250ml, 350ml, and 450ml sizes."
    }
  ]
}
```

---

## 🧪 Testing & Debug APIs

### Test Environment
```http
GET /api/test-env
```

**Response:**
```json
{
  "supabase_url": "https://tscjbpdorbxmbxcqyiri.supabase.co",
  "elevenlabs_configured": true,
  "openai_configured": true,
  "environment": "development"
}
```

### Test Knowledge Variables
```http
POST /api/test-knowledge-variables
```

**Purpose**: Test dynamic variable generation for ElevenLabs

### Test Complete Flow
```http
POST /api/test-complete-flow
```

**Purpose**: End-to-end system test

### Test Session Start
```http
POST /api/test-session-start
```

**Purpose**: Test session initialization

---

## 🎵 Audio & Recording APIs

### Text-to-Speech
```http
POST /api/tts
```

**Request Body:**
```json
{
  "text": "Hello, how can I help you today?",
  "language": "en"
}
```

### Speech-to-Text
```http
POST /api/stt
```

**Request Body:** Multipart form with audio file

### Get Conversation Audio
```http
GET /api/elevenlabs-conversation-audio/{conversationId}
```

**Purpose**: Retrieve recorded audio from ElevenLabs conversation

---

## 📡 Real-time APIs

### TTS Streaming
```http
POST /api/tts-streaming
```

**Purpose**: Streaming text-to-speech for real-time audio

### STT Streaming
```http
POST /api/stt-streaming
```

**Purpose**: Streaming speech-to-text for real-time transcription

---

## ❌ Error Responses

### Standard Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### Common Error Codes
- `400` - Bad Request: Invalid parameters
- `401` - Unauthorized: Authentication required
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource doesn't exist
- `405` - Method Not Allowed: Wrong HTTP method
- `500` - Internal Server Error: System error

### ElevenLabs Specific Errors
```json
{
  "error": "ElevenLabs token request failed",
  "code": "ELEVENLABS_ERROR",
  "details": {
    "status": "missing_permissions",
    "message": "The API key you used is missing the permission convai_write"
  }
}
```

---

## 🔧 API Usage Examples

### Complete Training Flow

#### 1. Get Employee Assignments
```bash
curl "http://localhost:3000/api/track-assignments?employee_id=f68046c7-e78d-4793-909f-61a6f6587485"
```

#### 2. Load Knowledge for Scenario
```bash
curl -X POST http://localhost:3000/api/scenario-knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_id": "demo-scenario-1",
    "company_id": "01f773e2-1027-490e-8d36-279136700bbf"
  }'
```

#### 3. Generate ElevenLabs Token
```bash
curl "http://localhost:3000/api/elevenlabs-token?agentId=agent_5101k5ksv08newj9b4aa2wt282hv&trainingMode=theory"
```

#### 4. Start Training Session
```bash
curl -X POST http://localhost:3000/api/avatar-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_id": "demo-assignment-1758312913428-7qtmmsq",
    "language": "en"
  }'
```

### Knowledge Management

#### Create Knowledge Category
```bash
curl -X POST http://localhost:3000/api/knowledge-base/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee Recipes",
    "description": "Step-by-step coffee preparation guides",
    "company_id": "01f773e2-1027-490e-8d36-279136700bbf"
  }'
```

#### Add Knowledge Document
```bash
curl -X POST http://localhost:3000/api/knowledge-base/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Espresso Preparation",
    "content": "1. Grind beans to fine consistency...",
    "category_id": "category-uuid",
    "company_id": "01f773e2-1027-490e-8d36-279136700bbf"
  }'
```

---

## 📊 Rate Limits & Performance

### ElevenLabs API Limits
- **Token Generation**: ~1 second response time
- **Conversation**: Real-time audio processing
- **Rate Limits**: Based on ElevenLabs subscription

### Database Performance
- **Assignment Queries**: ~400-700ms response time
- **Knowledge Loading**: ~500-600ms for 2 documents
- **Caching**: No caching implemented (potential improvement)

### Current Performance Metrics (from logs)
```
GET /api/elevenlabs-token: 655-1011ms
POST /api/scenario-knowledge: 485-691ms
GET /api/track-assignments: 442-693ms
GET /api/knowledge-base/documents: 333-484ms
```

---

This API reference covers all current endpoints in the Hokku Training Simulation system with working examples and current performance characteristics.