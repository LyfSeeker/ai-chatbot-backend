import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { pool } from "../db/client.js";

const llmProvider = process.env.LLM_PROVIDER || "gemini";

let llm;
let embeddings;

if (llmProvider === "gemini") {
  llm = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-1.5-flash",
    temperature: 0.3
  });
  embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "text-embedding-004"
  });
} else {
  llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3
  });
  embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function generateResponse(session_id, userMessage) {
  // Get conversation history
  const historyRes = await pool.query(
    `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [session_id]
  );
  const history = historyRes.rows.reverse().map(m => `${m.role}: ${m.content}`).join("\n");

  // Get document context - try vector search first, then fallback to documents table
  let context = "";
  
  try {
    const queryVector = await embeddings.embedQuery(userMessage);
    const vectorRes = await pool.query(
      `SELECT content FROM embeddings WHERE session_id = $1 ORDER BY embedding <-> $2::vector LIMIT 5`,
      [session_id, JSON.stringify(queryVector)]
    );
    if (vectorRes.rows.length > 0) {
      context = vectorRes.rows.map(r => r.content).join("\n\n");
    }
  } catch (e) {
    // Fallback to documents table if vector search fails
    const docsRes = await pool.query(
      `SELECT content FROM documents WHERE session_id = $1 ORDER BY id DESC LIMIT 1`,
      [session_id]
    );
    if (docsRes.rows.length > 0) {
      context = docsRes.rows[0].content;
    }
  }

  // Build prompt
  const prompt = `You are a helpful AI assistant. Use the context and conversation history to answer.

${context ? `Document Context:\n${context}\n` : "No documents uploaded yet."}

Conversation History:
${history || "None"}

User: ${userMessage}
Assistant:`;

  // Call LLM and return response
  const response = await llm.invoke(prompt);
  return response.content;
}
