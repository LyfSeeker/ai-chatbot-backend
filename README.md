# AI Chatbot Backend 

A sophisticated backend API for an AI-powered chatbot featuring Retrieval Augmented Generation (RAG), document upload capabilities, and conversation history management. Built with Node.js, Express, LangChain, PostgreSQL, and pgvector.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

---

## ✨ Features

### Core Features
- **Document Upload API**: Upload TXT files for context-aware conversations
- **Chat API**: AI-powered conversations with RAG implementation
- **Conversation History**: All chat messages stored and retrieved from database
- **Session Management**: Segregate chats and documents by session ID
- **Vector Search**: Semantic search using pgvector for relevant context retrieval

### Advanced Features
- **Multi-LLM Support**: Configurable LLM providers (OpenAI, Google Gemini)
- **RAG Implementation**: Retrieval Augmented Generation using uploaded documents
- **Graceful Degradation**: Continues functioning even if LLM APIs are unavailable
- **Docker Support**: Fully containerized application with docker-compose

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Postman/API)                      │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                │
        ┌────────▼────────┐              ┌───────▼────────┐
        │  POST /upload   │              │  POST /chat    │
        │  (File Upload)  │              │  (Chat API)    │
        └────────┬────────┘              └───────┬────────┘
                 │                                │
                 │                                │
        ┌────────▼─────────────────────────────┐ │
        │        Express.js Backend             │ │
        │  ┌─────────────────────────────────┐  │ │
        │  │   Routes Layer                  │  │ │
        │  │  - upload.js                    │  │ │
        │  │  - chat.js                      │  │ │
        │  └──────────┬──────────────────────┘  │ │
        │             │                          │ │
        │  ┌──────────▼──────────────────────┐  │ │
        │  │   Services Layer                │  │ │
        │  │  - embeddings.js (Vector Gen)   │  │ │
        │  │  - rag.js (RAG Logic)           │  │ │
        │  └──────────┬──────────────────────┘  │ │
        └─────────────┼──────────────────────────┘ │
                      │                            │
          ┌───────────▼───────────┐       ┌───────▼────────┐
          │   LangChain/OpenAI    │       │   LLM Provider │
          │  Embeddings Generator │       │  (Gemini/OpenAI)│
          └───────────┬───────────┘       └───────┬────────┘
                      │                           │
                      └───────────┬───────────────┘
                                  │
                      ┌───────────▼────────────┐
                      │  PostgreSQL + pgvector │
                      │  ┌──────────────────┐  │
                      │  │  Tables:         │  │
                      │  │  - sessions      │  │
                      │  │  - messages      │  │
                      │  │  - documents     │  │
                      │  │  - embeddings    │  │
                      │  └──────────────────┘  │
                      └────────────────────────┘
```

### Data Flow

#### Upload Flow
1. Client uploads document (TXT) with session_id
2. File is parsed and text extracted
3. Text is chunked (1000 chars per chunk)
4. Each chunk is converted to embeddings using OpenAI
5. Embeddings (1536-dimensional vectors) stored in pgvector
6. Document content stored in documents table

#### Chat Flow
1. Client sends message with session_id
2. User message stored in messages table
3. RAG retrieval:
   - Fetch conversation history from messages table
   - Generate query embedding
   - Perform vector similarity search in embeddings table
   - Retrieve relevant document chunks
4. Build context-aware prompt with:
   - Retrieved document context
   - Conversation history
   - User query
5. Send to LLM (Gemini/OpenAI) for response generation
6. Store AI response in messages table
7. Return response to client

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: PostgreSQL 16 with pgvector extension
- **Vector Store**: pgvector (for embeddings)
- **LLM Integration**: LangChain
- **LLM Providers**: OpenAI GPT / Google Gemini
- **Containerization**: Docker, Docker Compose
- **File Handling**: Multer
- **Environment Management**: dotenv

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20 or higher ([Download](https://nodejs.org/))
- **Docker Desktop**: ([Download](https://www.docker.com/products/docker-desktop/))
- **Git**: ([Download](https://git-scm.com/))
- **API Keys**: 
  - OpenAI API key ([Get here](https://platform.openai.com/api-keys)) OR
  - Google Gemini API key ([Get here](https://ai.google.dev/))

---

## 🚀 Installation & Setup

### Option 1: Docker (Recommended)

This will start both the database and backend with a single command.

```bash
# 1. Clone the repository
git clone https://github.com/LyfSeeker/ai-chatbot-backend.git
cd ai-chatbot-backend

# 2. Create .env file
cp .env.example .env

# 3. Edit .env and add your API keys
# Update OPENAI_API_KEY or GEMINI_API_KEY

# 4. Start everything with Docker Compose
docker-compose up -d

# 5. Check logs
docker-compose logs -f

# 6. Stop everything
docker-compose down
```

The application will be available at `http://localhost:3000`

### Option 2: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/LyfSeeker/ai-chatbot-backend.git
cd ai-chatbot-backend

# 2. Install dependencies
npm install

# 3. Start PostgreSQL with Docker
docker-compose up postgres -d

# 4. Create .env file
cp .env.example .env

# 5. Edit .env and configure:
#    - Add your API key (OPENAI_API_KEY or GEMINI_API_KEY)
#    - Set LLM_PROVIDER (openai or gemini)

# 6. Set up database tables
docker exec -it chatbot-db psql -U postgres -d chatbot

# Run these SQL commands:
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  content TEXT
);

CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  embedding VECTOR(1536),
  content TEXT
);

# Exit psql with \q

# 7. Start the development server
npm run dev

# Server will start on http://localhost:3000
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Health Check
```http
GET /
```

**Response:**
```
AI Chatbot Backend Running
```

#### 2. Upload Document
```http
POST /upload
```

**Content-Type:** `multipart/form-data`

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | TXT file to upload |
| session_id | String | Yes | Session identifier |

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@document.txt" \
  -F "session_id=session123"
```

**Success Response:**
```json
{
  "message": "File processed and embeddings stored"
}
```

**Error Response:**
```json
{
  "error": "file and session_id required"
}
```

#### 3. Chat
```http
POST /chat
```

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "session_id": "session123",
  "message": "What is this document about?"
}
```

**Success Response:**
```json
{
  "reply": "Based on the uploaded document context..."
}
```

**Error Response:**
```json
{
  "error": "session_id and message required"
}
```

### Testing with Postman

1. **Import Collection**: Create requests as shown above
2. **Test Upload**:
   - Method: POST
   - URL: `http://localhost:3000/upload`
   - Body → form-data
   - Add `file` (type: File)
   - Add `session_id` (type: Text)

3. **Test Chat**:
   - Method: POST
   - URL: `http://localhost:3000/chat`
   - Body → raw → JSON
   - Send message with session_id

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# Server Port
PORT=3000

# LLM Provider (openai or gemini)
LLM_PROVIDER=gemini

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here

# Google Gemini Configuration
GEMINI_API_KEY=your-gemini-key-here

# Database URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot
```

### Configuration Notes

- **LLM_PROVIDER**: Set to `openai` to use OpenAI GPT, or `gemini` to use Google Gemini
- **API Keys**: You only need one (either OpenAI OR Gemini)
- **DATABASE_URL**: Use `localhost` for local development, `postgres` (service name) when using Docker Compose

---

## 🗄️ Database Schema

### Tables

#### 1. sessions
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. messages
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. documents
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  content TEXT
);
```

#### 4. embeddings
```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  embedding VECTOR(1536),      -- OpenAI embeddings dimension
  content TEXT
);
```

### Indexes
For better performance, consider adding:
```sql
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_embeddings_session ON embeddings(session_id);
CREATE INDEX idx_documents_session ON documents(session_id);
```

---

## 📁 Project Structure

```
ai-chatbot-backend/
├── src/
│   ├── routes/
│   │   ├── upload.js          # File upload endpoint
│   │   └── chat.js            # Chat endpoint
│   ├── services/
│   │   ├── embeddings.js      # Vector embedding generation
│   │   └── rag.js             # RAG implementation
│   ├── db/
│   │   └── client.js          # Database connection pool
│   └── index.js               # Express app entry point
├── uploads/                    # Temporary file storage
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── docker-compose.yml         # Docker orchestration
├── Dockerfile                 # Backend container definition
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

---

## 🛡️ Error Handling

### OpenAI Quota Handling

If OpenAI API quota is exceeded, the system gracefully falls back to a context-based response while still executing vector similarity search and the complete RAG pipeline. This ensures uninterrupted functionality and demonstrates robust error handling.

The system continues to:
- Store and retrieve vector embeddings
- Perform similarity searches
- Manage conversation history
- Maintain session segregation

### Graceful Degradation

- If embeddings generation fails, documents are still stored
- If vector search fails, system retrieves from documents table
- If LLM is unavailable, contextual response is returned
- All errors are logged for debugging

---

## 🧪 Testing

### Manual Testing

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Test database connection**:
   ```bash
   curl http://localhost:3000/db-test
   ```

3. **Upload a document**:
   ```bash
   curl -X POST http://localhost:3000/upload \
     -F "file=@test.txt" \
     -F "session_id=test123"
   ```

4. **Send a chat message**:
   ```bash
   curl -X POST http://localhost:3000/chat \
     -H "Content-Type: application/json" \
     -d '{"session_id":"test123","message":"What is this document about?"}'
   ```

### Database Verification

```bash
# Check embeddings
docker exec -it chatbot-db psql -U postgres -d chatbot \
  -c "SELECT COUNT(*) FROM embeddings WHERE session_id='test123';"

# Check messages
docker exec -it chatbot-db psql -U postgres -d chatbot \
  -c "SELECT role, content FROM messages WHERE session_id='test123';"
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Docker not running**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Start Docker Desktop and run `docker-compose up`

**2. Database connection failed**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: 
- Check if PostgreSQL container is running: `docker ps`
- Restart database: `docker-compose restart postgres`

**3. API Key errors**
```
Error: 429 quota exceeded
```
**Solution**:
- Add credits to your OpenAI account OR
- Switch to Gemini by setting `LLM_PROVIDER=gemini` in .env

**4. Embeddings not storing**
```
No embeddings were stored
```
**Solution**:
- Verify your API key is valid
- Check API quota/billing
- Review server logs for detailed errors

**5. Port already in use**
```
Error: Port 3000 is already in use
```
**Solution**:
- Change PORT in .env to another port (e.g., 3001)
- Or stop the process using port 3000

---

## 📝 Notes

- **File Support**: Currently supports TXT files. PDF support can be added if needed.
- **Session IDs**: Use unique session IDs for different conversations
- **Conversation History**: Limited to last 10 messages for context window management
- **Chunk Size**: Documents are split into 1000-character chunks for optimal embedding

---

## 🤝 Contributing

This is a project for the Atlantis Residency Program evaluation. For questions or issues, please contact the repository owner.

---

## 📄 License

ISC

---

## 👤 Author

**LyfSeeker**
- GitHub: [@LyfSeeker](https://github.com/LyfSeeker)

---

## 🙏 Acknowledgments

- Built with [LangChain](https://www.langchain.com/)
- Vector storage powered by [pgvector](https://github.com/pgvector/pgvector)
- LLM providers: [OpenAI](https://openai.com/) & [Google Gemini](https://ai.google.dev/)

---

**Note**: This project demonstrates a production-ready RAG implementation with comprehensive error handling, session management, and multi-LLM support.
