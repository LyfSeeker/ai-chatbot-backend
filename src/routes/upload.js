import express from "express";
import multer from "multer";
import fs from "fs";
import { storeEmbeddings } from "../services/embeddings.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { session_id } = req.body;
    const file = req.file;

    if (!file || !session_id) {
      return res.status(400).json({ error: "file and session_id required" });
    }

    const text = fs.readFileSync(file.path, "utf-8");
    await storeEmbeddings(session_id, text);
    fs.unlinkSync(file.path);

    res.json({ message: "File processed and embeddings stored" });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
