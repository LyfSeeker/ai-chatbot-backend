# AI Chatbot Backend

Backend API for an AI chatbot with RAG (Retrieval Augmented Generation), document upload, and conversation history.

## Tech Stack

- Node.js + Express
- PostgreSQL + pgvector
- LangChain (Gemini/OpenAI)
- Docker

## Prerequisites

- Node.js v20+
- Docker Desktop
- Gemini API Key (free at https://ai.google.dev/)

## Quick Start (Docker)

```bash
git clone https://github.com/LyfSeeker/ai-chatbot-backend.git
cd ai-chatbot-backend

cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

docker-compose up -d
```

Server runs at http://localhost:3000

## Local Development

```bash
npm install

# Start database
docker-compose up postgres -d

# Setup tables (auto-runs from init.sql, or manually):
docker exec -it chatbot-db psql -U postgres -d chatbot -f /docker-entrypoint-initdb.d/init.sql

cp .env.example .env
# Add your API key

npm run dev
```

## API Endpoints

### Upload Document
```
POST /upload
Content-Type: multipart/form-data

file: <your-file.txt>
session_id: "session123"
```

### Chat
```
POST /chat
Content-Type: application/json

{
  "session_id": "session123",
  "message": "What is this document about?"
}
```

## Database Schema

- **messages** - Stores conversation history (user + assistant messages)
- **documents** - Stores uploaded document content
- **embeddings** - Stores vector embeddings for RAG similarity search

## Environment Variables

```
PORT=3000
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot
```

## Project Structure

```
src/
├── index.js           # Express server
├── routes/
│   ├── upload.js      # POST /upload
│   └── chat.js        # POST /chat
├── services/
│   ├── embeddings.js  # Vector embedding generation
│   └── rag.js         # RAG + LLM response
└── db/
    └── client.js      # PostgreSQL connection
```

## How It Works

1. **Upload**: Document → chunks → embeddings → stored in pgvector
2. **Chat**: Query → vector search → get relevant context → LLM generates response
3. **History**: All messages stored in DB and included in prompt context
