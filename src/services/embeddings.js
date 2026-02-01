import { pool } from "../db/client.js";

export async function storeEmbeddings(session_id, text) {
  // Store document in database
  await pool.query(
    "INSERT INTO documents (session_id, content) VALUES ($1, $2)",
    [session_id, text]
  );

  return { success: true };
}

