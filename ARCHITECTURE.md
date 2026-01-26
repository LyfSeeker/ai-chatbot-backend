# AI Chatbot Backend - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Details](#component-details)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Database Schema](#database-schema)
6. [Technology Stack](#technology-stack)
7. [Security & Error Handling](#security--error-handling)

---

## System Overview

The AI Chatbot Backend is a production-ready RESTful API that implements **Retrieval Augmented Generation (RAG)** to provide context-aware conversational AI. It combines document upload capabilities, vector similarity search, conversation history management, and multi-LLM support.

### Key Features
- 📄 **Document Upload**: Process TXT files and generate vector embeddings
- 💬 **Conversational AI**: Chat with context from uploaded documents
- 🔍 **Vector Search**: Semantic similarity search using pgvector
- 📚 **History Management**: Persist and retrieve conversation context
- 🔐 **Session Isolation**: Separate conversations per session
- 🤖 **Multi-LLM**: Support for OpenAI and Google Gemini

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                             │
│                     (Postman, Frontend Apps, APIs)                   │
└──────────────────┬─────────────────────────┬────────────────────────┘
                   │                         │
                   │                         │
     ┌─────────────▼──────────┐    ┌────────▼─────────┐
     │  POST /upload          │    │  POST /chat      │
     │  (File Upload API)     │    │  (Chat API)      │
     └─────────────┬──────────┘    └────────┬─────────┘
                   │                         │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │    EXPRESS.JS BACKEND   │
                   │   (Node.js v20+)        │
                   │                         │
                   │  ┌─────────────────┐    │
                   │  │  ROUTES LAYER   │    │
                   │  │  - upload.js    │    │
                   │  │  - chat.js      │    │
                   │  └────────┬────────┘    │
                   │           │             │
                   │  ┌────────▼────────┐    │
                   │  │ SERVICES LAYER  │    │
                   │  │ - embeddings.js │    │
                   │  │ - rag.js        │    │
                   │  └────────┬────────┘    │
                   │           │             │
                   │  ┌────────▼────────┐    │
                   │  │  DATABASE LAYER │    │
                   │  │  - client.js    │    │
                   │  └────────┬────────┘    │
                   └───────────┼─────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
    ┌───────▼────────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │   LangChain    │  │  PostgreSQL │  │ LLM Provider│
    │   Embeddings   │  │  + pgvector │  │  (Gemini/   │
    │    (OpenAI)    │  │             │  │   OpenAI)   │
    └────────────────┘  └─────────────┘  └─────────────┘
```

---

## Component Details

### 1. API Layer (Express.js)

**Location**: `src/index.js`, `src/routes/`

#### Responsibilities:
- HTTP request handling
- Request validation
- Error response formatting
- Route mounting and middleware configuration

#### Endpoints:

| Endpoint | Method | Purpose | Input | Output |
|----------|--------|---------|-------|--------|
| `/` | GET | Health check | None | Status message |
| `/db-test` | GET | Database health | None | Current timestamp |
| `/upload` | POST | Upload document | File + session_id | Success message |
| `/chat` | POST | Chat message | session_id + message | AI response |

---

### 2. Routes Layer

#### Upload Route (`src/routes/upload.js`)

```
┌──────────────────────────────────────────────┐
│         POST /upload Handler                 │
├──────────────────────────────────────────────┤
│  1. Receive file via Multer                  │
│  2. Validate session_id and file             │
│  3. Read file content (TXT)                  │
│  4. Call storeEmbeddings()                   │
│  5. Delete temporary file                    │
│  6. Return success response                  │
└──────────────────────────────────────────────┘
```

**Dependencies**:
- Multer: Multipart form handling
- fs: File system operations
- embeddings.js: Vector generation

---

#### Chat Route (`src/routes/chat.js`)

```
┌──────────────────────────────────────────────┐
│          POST /chat Handler                  │
├──────────────────────────────────────────────┤
│  1. Validate session_id and message          │
│  2. INSERT user message to DB                │
│  3. Call generateResponse() for RAG          │
│  4. INSERT assistant reply to DB             │
│  5. Return AI response                       │
└──────────────────────────────────────────────┘
```

**Dependencies**:
- PostgreSQL pool: Database operations
- rag.js: RAG implementation

---

### 3. Services Layer

#### Embeddings Service (`src/services/embeddings.js`)

**Purpose**: Convert text to vector embeddings for semantic search

```
┌────────────────────────────────────────────────┐
│       storeEmbeddings(session_id, text)        │
├────────────────────────────────────────────────┤
│  1. Split text into chunks (1000 chars each)   │
│  2. Generate embeddings via OpenAI API         │
│     - Model: text-embedding-ada-002            │
│     - Dimensions: 1536                         │
│  3. Store in documents table (full text)       │
│  4. For each chunk:                            │
│     - Generate embedding vector                │
│     - INSERT into embeddings table             │
│  5. Verify storage with SELECT query           │
│  6. Return success (even if embeddings fail)   │
└────────────────────────────────────────────────┘
```

**Key Features**:
- Graceful degradation on API quota errors
- Chunking strategy for large documents
- Verification logging for debugging

---

#### RAG Service (`src/services/rag.js`)

**Purpose**: Implement Retrieval Augmented Generation for context-aware responses

```
┌─────────────────────────────────────────────────┐
│    generateResponse(session_id, userMessage)    │
├─────────────────────────────────────────────────┤
│  1. RETRIEVE CONVERSATION HISTORY               │
│     SELECT last 10 messages WHERE session_id    │
│                                                  │
│  2. GENERATE QUERY EMBEDDING                    │
│     OpenAI embeddings API for user message      │
│                                                  │
│  3. VECTOR SIMILARITY SEARCH                    │
│     SELECT * FROM embeddings                    │
│     WHERE session_id = ?                        │
│     ORDER BY embedding <-> query_vector         │
│     LIMIT 5                                     │
│                                                  │
│  4. FALLBACK TO DOCUMENTS (if no embeddings)    │
│     SELECT content FROM documents               │
│     WHERE session_id = ?                        │
│                                                  │
│  5. BUILD CONTEXT-AWARE PROMPT                  │
│     - System message                            │
│     - Document context                          │
│     - Conversation history                      │
│     - User query                                │
│                                                  │
│  6. INVOKE LLM (Gemini or OpenAI)               │
│     Based on LLM_PROVIDER env variable          │
│                                                  │
│  7. RETURN AI RESPONSE                          │
│     (or fallback response if LLM fails)         │
└─────────────────────────────────────────────────┘
```

**Key Features**:
- pgvector `<->` operator for cosine similarity
- Multi-LLM support (configurable provider)
- History-aware prompting
- Error resilience with fallback responses

---

### 4. Database Layer

**Location**: `src/db/client.js`

**Purpose**: Manage PostgreSQL connection pooling

```
┌──────────────────────────────────┐
│     PostgreSQL Connection Pool   │
├──────────────────────────────────┤
│  - Reuses connections             │
│  - Handles concurrent queries     │
│  - Auto-reconnection              │
│  - Connection string from env     │
└──────────────────────────────────┘
```

---

## Data Flow Diagrams

### Upload Flow (Document Processing)

```
    ┌─────────┐
    │  User   │
    └────┬────┘
         │
         │ 1. Upload TXT file + session_id
         ▼
    ┌────────────┐
    │   Multer   │  Saves to uploads/
    └────┬───────┘
         │
         │ 2. File path
         ▼
    ┌─────────────┐
    │ Upload Route│  fs.readFileSync()
    └────┬────────┘
         │
         │ 3. Text content
         ▼
    ┌──────────────────┐
    │ Embeddings Svc   │  Split into chunks
    └────┬─────────────┘
         │
         │ 4. For each chunk
         ▼
    ┌──────────────────┐
    │  OpenAI API      │  Generate vector (1536-d)
    └────┬─────────────┘
         │
         │ 5. Embedding vector
         ▼
    ┌──────────────────┐
    │  PostgreSQL      │  INSERT INTO embeddings
    │  (pgvector)      │  INSERT INTO documents
    └──────────────────┘
```

---

### Chat Flow (RAG Pipeline)

```
    ┌─────────┐
    │  User   │
    └────┬────┘
         │
         │ 1. Send message + session_id
         ▼
    ┌─────────────┐
    │ Chat Route  │  Save user message
    └────┬────────┘
         │
         │ 2. Trigger RAG
         ▼
    ┌─────────────┐
    │  RAG Service│
    └────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         │ 3a. Get history                     │ 3b. Get context
         ▼                                     ▼
    ┌─────────────┐                      ┌──────────────┐
    │ PostgreSQL  │                      │  Generate    │
    │ messages    │                      │  query       │
    │ table       │                      │  embedding   │
    └────┬────────┘                      └──────┬───────┘
         │                                       │
         │                                       │ 4. Vector search
         │                                       ▼
         │                              ┌──────────────────┐
         │                              │  PostgreSQL      │
         │                              │  embeddings      │
         │                              │  (similarity)    │
         │                              └──────┬───────────┘
         │                                     │
         └──────────────┬──────────────────────┘
                        │
                        │ 5. Build prompt (context + history + query)
                        ▼
                   ┌─────────────┐
                   │  LLM API    │  Gemini or OpenAI
                   │  (Gemini/   │
                   │   OpenAI)   │
                   └────┬────────┘
                        │
                        │ 6. AI response
                        ▼
                   ┌─────────────┐
                   │ Save reply  │  INSERT INTO messages
                   │ to DB       │
                   └────┬────────┘
                        │
                        │ 7. Return response
                        ▼
                   ┌─────────┐
                   │  User   │
                   └─────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐
│    sessions      │
├──────────────────┤
│ id (TEXT) PK     │◄──────────┐
│ created_at       │           │
└──────────────────┘           │
                               │
                               │
┌──────────────────┐           │
│    messages      │           │
├──────────────────┤           │
│ id (SERIAL) PK   │           │
│ session_id (FK)  │───────────┤
│ role (TEXT)      │           │
│ content (TEXT)   │           │
│ created_at       │           │
└──────────────────┘           │
                               │
┌──────────────────┐           │
│   documents      │           │
├──────────────────┤           │
│ id (SERIAL) PK   │           │
│ session_id (FK)  │───────────┤
│ content (TEXT)   │           │
└──────────────────┘           │
                               │
┌──────────────────┐           │
│   embeddings     │           │
├──────────────────┤           │
│ id (SERIAL) PK   │           │
│ session_id (FK)  │───────────┘
│ embedding VECTOR │  ← 1536 dimensions
│ content (TEXT)   │  ← Chunk text
└──────────────────┘
```

### Table Details

#### `sessions`
- **Purpose**: Track active chat sessions
- **Primary Key**: `id` (user-defined session identifier)
- **Indexes**: Primary key index

#### `messages`
- **Purpose**: Store conversation history
- **Fields**:
  - `role`: "user" or "assistant"
  - `content`: Message text
- **Indexes**: Consider `idx_messages_session` for performance

#### `documents`
- **Purpose**: Full text storage for uploaded files
- **Usage**: Fallback when embeddings are unavailable
- **Indexes**: Consider `idx_documents_session`

#### `embeddings`
- **Purpose**: Vector embeddings for semantic search
- **Fields**:
  - `embedding`: VECTOR(1536) - pgvector type
  - `content`: Original text chunk
- **Indexes**: 
  - Consider `idx_embeddings_session`
  - pgvector uses HNSW or IVFFlat for vector similarity

---

## Technology Stack

### Backend Framework
```
Express.js v5.2.1
├── CORS middleware (cross-origin requests)
├── JSON body parser
└── URL-encoded parser
```

### Database
```
PostgreSQL 16
└── pgvector extension
    ├── Vector data type
    └── Similarity operators (<->, <#>, <=>)
```

### LLM Integration
```
LangChain Framework
├── @langchain/openai
│   ├── OpenAIEmbeddings (text-embedding-ada-002)
│   └── ChatOpenAI (gpt-3.5-turbo)
└── @langchain/google-genai
    └── ChatGoogleGenerativeAI (gemini-pro)
```

### File Handling
```
Multer v1.4.5-lts.1
└── Multipart form-data parsing
```

### Containerization
```
Docker
├── PostgreSQL container (pgvector/pgvector:pg16)
└── Node.js container (node:20-alpine)
```

---

## Security & Error Handling

### Security Measures

1. **Environment Variables**: API keys stored in `.env` (not committed to git)
2. **Input Validation**: Required fields checked on all endpoints
3. **Session Isolation**: All queries filter by `session_id`
4. **File Cleanup**: Temporary uploads deleted after processing
5. **SQL Parameterization**: Prepared statements prevent SQL injection

### Error Handling Strategy

```
┌─────────────────────────────────────────┐
│         Error Handling Layers           │
├─────────────────────────────────────────┤
│  1. Route-level try-catch               │
│     → Returns 500 with error message    │
│                                          │
│  2. Service-level graceful degradation  │
│     → Embeddings: Falls back to docs    │
│     → LLM: Returns context-based reply  │
│                                          │
│  3. Database error logging              │
│     → Console.error with context        │
│                                          │
│  4. API quota handling                  │
│     → Continues without embeddings      │
│     → Uses document table fallback      │
└─────────────────────────────────────────┘
```

### Graceful Degradation Examples

| Failure Scenario | System Behavior |
|------------------|-----------------|
| OpenAI API quota exceeded | Stores document without embeddings, RAG uses document table |
| Vector search returns empty | Falls back to SELECT from documents table |
| LLM API unavailable | Returns contextual message: "Based on your uploaded documents..." |
| Database connection lost | Returns 500 error with retry suggestion |

---

## Performance Considerations

### Optimization Strategies

1. **Connection Pooling**: PostgreSQL pool reuses connections
2. **Vector Indexing**: pgvector HNSW index for fast similarity search
3. **Chunk Size**: 1000 characters balances context vs. performance
4. **History Limit**: Last 10 messages prevent token overflow
5. **Result Limiting**: Top 5 similar chunks for RAG context

### Scalability

- **Horizontal Scaling**: Stateless design allows multiple instances
- **Database Scaling**: PostgreSQL read replicas for heavy query loads
- **Caching**: Future: Redis for conversation history
- **Async Processing**: File uploads could use job queues for large files

---

## Development Workflow

```
┌────────────────────────────────────────────┐
│         Development Environment            │
├────────────────────────────────────────────┤
│  1. Clone repository                       │
│  2. npm install                            │
│  3. docker-compose up postgres -d          │
│  4. Set up .env with API keys              │
│  5. Run database migrations (SQL)          │
│  6. npm run dev (nodemon for hot reload)   │
│  7. Test with Postman                      │
└────────────────────────────────────────────┘
```

### Testing Approach

- **Manual Testing**: Postman collections
- **Database Verification**: Direct psql queries
- **Log Monitoring**: Console logs with emoji indicators 🚀📊✅
- **Error Simulation**: Test with invalid API keys, missing fields

---

## Deployment Architecture

### Docker Compose Setup

```
docker-compose.yml
├── postgres (service)
│   ├── Image: pgvector/pgvector:pg16
│   ├── Port: 5432
│   ├── Volume: postgres_data (persistence)
│   └── Healthcheck: pg_isready
│
└── backend (service)
    ├── Build: Dockerfile
    ├── Port: 3000
    ├── Depends on: postgres (healthy)
    └── Environment: API keys, DATABASE_URL
```

### Single-Command Deployment

```bash
docker-compose up -d
```

This starts:
1. PostgreSQL with pgvector
2. Backend Node.js application
3. Automatic health checks and dependencies
4. Persistent data storage

---

## Future Enhancements

1. **PDF Support**: Add pdf-parse for document variety
2. **Authentication**: JWT-based session authentication
3. **Rate Limiting**: Prevent API abuse
4. **Caching**: Redis for conversation history
5. **WebSockets**: Real-time streaming responses
6. **Admin Dashboard**: Session management UI
7. **Analytics**: Track usage metrics and costs
8. **Multi-file Upload**: Batch document processing
9. **File Type Detection**: Automatic format handling
10. **Vector Indexing**: IVFFlat/HNSW tuning for scale

---

**Last Updated**: 2024
**Version**: 1.0.0
**Author**: LyfSeeker
