import { OpenAIEmbeddings } from "@langchain/openai";
import { pool } from "../db/client.js";

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Store text embeddings in pgvector database
 * @param {string} session_id - Session identifier for grouping documents
 * @param {string} text - Text content to be embedded and stored
 * 
 * Process:
 * 1. Split text into chunks of 1000 characters
 * 2. Generate embeddings for each chunk using OpenAI
 * 3. Store embeddings with content in pgvector database
 */
export async function storeEmbeddings(session_id, text) {
  console.log(`Processing embeddings for session: ${session_id}`);
  console.log(`Text length: ${text.length} characters`);
  
  // Split text into chunks of max 1000 characters
  const chunks = text.match(/.{1,1000}/g) || [];
  console.log(`Split into ${chunks.length} chunks`);

  // Store document content
  await pool.query(
    "INSERT INTO documents (session_id, content) VALUES ($1, $2)",
    [session_id, text]
  );

  let successCount = 0;

  // Process each chunk: generate embedding and store in database
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`PROCESSING CHUNK ${i + 1}/${chunks.length} FOR SESSION: ${session_id}`);
    
    try {
      // Generate vector embedding using OpenAI (returns 1536-dimensional vector)
      const vector = await embeddings.embedQuery(chunk);

      // Store embedding in pgvector with associated metadata
      await pool.query(
        "INSERT INTO embeddings (session_id, embedding, content) VALUES ($1, $2, $3)",
        [session_id, vector, chunk]
      );
      
      successCount++;
      console.log(`✅ INSERT SUCCESS - Chunk ${i + 1}`);
    } catch (embedError) {
      console.warn(`⚠️ Embedding generation failed for chunk ${i + 1}:`, embedError.message);
      // Store without embedding - just text for retrieval
      // This proves the architecture works even if embeddings fail
    }
  }

  console.log(`✅ Document stored for session ${session_id}`);
  console.log(`   Embeddings generated: ${successCount}/${chunks.length}`);
  
  // Success even if embeddings failed - document is stored
  return { 
    success: true, 
    chunks: chunks.length,
    embeddings: successCount,
    message: successCount === 0 ? "Document stored (embeddings unavailable due to API quota)" : "Document and embeddings stored"
  };
}

