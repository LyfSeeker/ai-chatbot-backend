import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { pool } from "../db/client.js";

const llmProvider = process.env.LLM_PROVIDER || "gemini";

let embeddings;
if (llmProvider === "gemini") {
  embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "text-embedding-004"
  });
} else {
  embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function storeEmbeddings(session_id, text) {
  // Split text into chunks
  const chunks = text.match(/.{1,1000}/g) || [];

  // Store full document
  await pool.query(
    "INSERT INTO documents (session_id, content) VALUES ($1, $2)",
    [session_id, text]
  );

  // Generate and store embeddings for each chunk
  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk);
    await pool.query(
      "INSERT INTO embeddings (session_id, embedding, content) VALUES ($1, $2, $3)",
      [session_id, JSON.stringify(vector), chunk]
    );
  }

  return { success: true, chunks: chunks.length };
}

