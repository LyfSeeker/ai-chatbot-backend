import express from "express";
import { pool } from "../db/client.js";
import { generateResponse } from "../services/rag.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { session_id, message } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({ error: "session_id and message required" });
    }

    // Save user message
    await pool.query(
      "INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)",
      [session_id, "user", message]
    );

    // Generate AI response with RAG
    const reply = await generateResponse(session_id, message);

    // Save assistant reply
    await pool.query(
      "INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)",
      [session_id, "assistant", reply]
    );

    res.json({ reply });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
