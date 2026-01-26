import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { pool } from "./db/client.js";
import uploadRoute from "./routes/upload.js";
import chatRoute from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Chatbot Backend Running");
});

// Database health check
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/upload", uploadRoute);
app.use("/chat", chatRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
