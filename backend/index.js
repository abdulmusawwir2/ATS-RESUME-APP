// import express from "express";
// import multer from "multer";
// import cors from "cors";
// import dotenv from "dotenv";
// import fs from "fs";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { exec } from "child_process";
// import { promisify } from "util";

// dotenv.config();

// const execAsync = promisify(exec);
// const app = express();
// const PORT = process.env.PORT || 8000;

// /* ================================
//    CONFIG
// ================================ */
// const MODEL_NAME = "gemini-2.5-flash";
// const MAX_FILE_SIZE = 10 * 1024 * 1024;

// /* ================================
//    MIDDLEWARE
// ================================ */
// app.use(cors());
// app.use(express.json());

// const upload = multer({
//   dest: "uploads/",
//   limits: { fileSize: MAX_FILE_SIZE },
//   fileFilter: (req, file, cb) => {
//     console.log("📎 Uploaded file:", file.originalname, file.mimetype);
//     if (file.mimetype === "application/pdf") cb(null, true);
//     else cb(new Error("Only PDF files allowed"), false);
//   },
// });

// /* ================================
//    AI INIT
// ================================ */
// if (!process.env.GOOGLE_API_KEY) {
//   console.error("❌ GOOGLE_API_KEY missing in .env");
//   process.exit(1);
// }

// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// console.log("✅ Google AI initialized with model:", MODEL_NAME);

// /* ================================
//    PDF TEXT EXTRACTION
// ================================ */
// const extractTextFromPDF = async (pdfPath) => {
//   console.log("📄 Trying pdftotext extraction...");
//   try {
//     const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
//     if (stdout && stdout.trim().length > 100) {
//       console.log("✅ pdftotext success:", stdout.length, "chars");
//       return stdout.trim();
//     }
//     throw new Error("pdftotext returned insufficient text");
//   } catch (err) {
//     console.warn("⚠️ pdftotext failed, using fallback:", err.message);
//   }

//   console.log("📄 Using binary fallback extraction...");
//   const buffer = fs.readFileSync(pdfPath);
//   let text = buffer.toString("utf8");
//   text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ");
//   text = text.replace(/\s+/g, " ").trim();

//   if (text.length < 50) {
//     throw new Error("Fallback extraction failed");
//   }

//   console.log("✅ Fallback extraction success:", text.length, "chars");
//   return text;
// };

// /* ================================
//    PDF → BASE64
// ================================ */
// const pdfToBase64 = (path) => {
//   console.log("🧾 Converting PDF to base64...");
//   const base64 = fs.readFileSync(path).toString("base64");
//   console.log("✅ Base64 size:", base64.length);
//   return base64;
// };

// /* ================================
//    AI ANALYSIS (TEXT)
// ================================ */
// const analyzeText = async (resumeText, jobDescription) => {
//   console.log("🤖 AI TEXT ANALYSIS START");
//   const prompt = `
// You are an ATS resume evaluator.

// JOB DESCRIPTION:
// ${jobDescription}

// RESUME:
// ${resumeText}

// Return ONLY JSON:
// {
//   "match_score": 0-100,
//   "missing_keywords": [],
//   "strengths": [],
//   "weaknesses": []
// }
// `;

//   const model = genAI.getGenerativeModel({ model: MODEL_NAME });
//   const result = await model.generateContent(prompt);
//   const raw = result.response.text();

//   console.log("🧠 AI RAW RESPONSE:", raw.slice(0, 200), "...");

//   return parseAIJson(raw);
// };

// /* ================================
//    AI ANALYSIS (VISION / PDF)
// ================================ */
// const analyzeVision = async (pdfBase64, jobDescription) => {
//   console.log("🤖 AI VISION ANALYSIS START");

//   const prompt = `
// You are an ATS resume evaluator.

// JOB DESCRIPTION:
// ${jobDescription}

// Return ONLY JSON:
// {
//   "match_score": 0-100,
//   "missing_keywords": [],
//   "strengths": [],
//   "weaknesses": []
// }
// `;

//   const model = genAI.getGenerativeModel({ model: MODEL_NAME });
//   const result = await model.generateContent([
//     { text: prompt },
//     { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
//   ]);

//   const raw = result.response.text();
//   console.log("🧠 AI RAW RESPONSE:", raw.slice(0, 200), "...");

//   return parseAIJson(raw);
// };

// /* ================================
//    JSON SAFE PARSER
// ================================ */
// const parseAIJson = (text) => {
//   console.log("🔍 Parsing AI JSON...");
//   const clean = text.replace(/```json|```/g, "");
//   const start = clean.indexOf("{");
//   const end = clean.lastIndexOf("}");

//   if (start === -1 || end === -1) {
//     throw new Error("No JSON found in AI response");
//   }

//   const parsed = JSON.parse(clean.slice(start, end + 1));

//   parsed.match_score = Math.max(0, Math.min(100, Number(parsed.match_score) || 0));
//   parsed.missing_keywords ||= [];
//   parsed.strengths ||= [];
//   parsed.weaknesses ||= [];

//   console.log("✅ JSON parsed successfully");
//   return parsed;
// };

// /* ================================
//    MAIN ENDPOINT
// ================================ */
// app.post("/evaluate", upload.single("file"), async (req, res) => {
//   let filePath = null;

//   try {
//     console.log("🚀 /evaluate called");

//     if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
//     if (!req.body.job_description)
//       return res.status(400).json({ error: "Job description missing" });

//     filePath = req.file.path;

//     try {
//       const text = await extractTextFromPDF(filePath);
//       const result = await analyzeText(text, req.body.job_description);
//       return res.json({ success: true, result, mode: "text" });
//     } catch (err) {
//       console.warn("⚠️ Text analysis failed:", err.message);
//       const base64 = pdfToBase64(filePath);
//       const result = await analyzeVision(base64, req.body.job_description);
//       return res.json({ success: true, result, mode: "vision" });
//     }
//   } catch (err) {
//     console.error("❌ SERVER ERROR:", err);
//     res.status(500).json({ error: err.message });
//   } finally {
//     if (filePath && fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//       console.log("🧹 Cleaned upload");
//     }
//   }
// });

// /* ================================
//    TEST AI
// ================================ */
// app.get("/test-ai", async (_, res) => {
//   try {
//     const model = genAI.getGenerativeModel({ model: MODEL_NAME });
//     const r = await model.generateContent("Reply ONLY with OK");
//     res.json({ ok: r.response.text().trim() });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// /* ================================
//    HEALTH
// ================================ */
// app.get("/health", (_, res) => {
//   res.json({
//     status: "OK",
//     model: MODEL_NAME,
//     uptime: process.uptime(),
//   });
// });

// /* ================================
//    START
// ================================ */
// if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// app.listen(PORT, () => {
//   console.log(`✅ Server running on http://localhost:${PORT}`);
//   console.log(`🔍 Health: http://localhost:${PORT}/health`);
//   console.log(`🤖 Test AI: http://localhost:${PORT}/test-ai`);
// });



import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { exec } from "child_process";
import { promisify } from "util";
import cosineSimilarity from "cosine-similarity";

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8000;

/* ================================
   CONFIG
================================ */
const MODEL_NAME = "gemini-2.5-flash";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ================================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    console.log("📎 Uploaded file:", file.originalname, file.mimetype);
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files allowed"), false);
  },
});

/* ================================
   AI INIT
================================ */
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY missing in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
console.log("✅ Google AI initialized with model:", MODEL_NAME);

/* ================================
   EMBEDDINGS (SEMANTIC SEARCH)
================================ */
const getEmbedding = async (text) => {
  console.log("🧠 Generating embedding...");
  const model = genAI.getGenerativeModel({ model: "models/embedding-001" });

  const result = await model.embedContent({
    content: { parts: [{ text }] },
  });

  return result.embedding.values;
};

const calculateSemanticScore = (resumeEmbedding, jdEmbedding) => {
  const similarity = cosineSimilarity(resumeEmbedding, jdEmbedding);
  return Math.round(similarity * 100);
};

/* ================================
   PDF TEXT EXTRACTION
================================ */
const extractTextFromPDF = async (pdfPath) => {
  console.log("📄 Trying pdftotext extraction...");
  try {
    const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
    if (stdout && stdout.trim().length > 100) {
      console.log("✅ pdftotext success:", stdout.length, "chars");
      return stdout.trim();
    }
    throw new Error("pdftotext returned insufficient text");
  } catch (err) {
    console.warn("⚠️ pdftotext failed, using fallback:", err.message);
  }

  console.log("📄 Using binary fallback extraction...");
  const buffer = fs.readFileSync(pdfPath);
  let text = buffer.toString("utf8");
  text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  if (text.length < 50) {
    throw new Error("Fallback extraction failed");
  }

  console.log("✅ Fallback extraction success:", text.length, "chars");
  return text;
};

/* ================================
   PDF → BASE64
================================ */
const pdfToBase64 = (path) => {
  console.log("🧾 Converting PDF to base64...");
  const base64 = fs.readFileSync(path).toString("base64");
  console.log("✅ Base64 size:", base64.length);
  return base64;
};

/* ================================
   AI ANALYSIS (TEXT + SEMANTIC)
================================ */
const analyzeText = async (resumeText, jobDescription) => {
  console.log("🤖 AI TEXT ANALYSIS START (Semantic + LLM)");

  // 1️⃣ Semantic similarity
  const [resumeEmbedding, jdEmbedding] = await Promise.all([
    getEmbedding(resumeText),
    getEmbedding(jobDescription),
  ]);

  const semanticScore = calculateSemanticScore(
    resumeEmbedding,
    jdEmbedding
  );

  console.log("📐 Semantic similarity score:", semanticScore);

  // 2️⃣ LLM reasoning
  const prompt = `
You are an ATS resume evaluator.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Semantic similarity score (0-100): ${semanticScore}

Use the semantic score while evaluating.

Return ONLY JSON:
{
  "match_score": 0-100,
  "missing_keywords": [],
  "strengths": [],
  "weaknesses": []
}
`;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  console.log("🧠 AI RAW RESPONSE:", raw.slice(0, 200), "...");

  const parsed = parseAIJson(raw);

  // 3️⃣ Hybrid scoring (70% semantic, 30% LLM)
  parsed.semantic_score = semanticScore;
  parsed.match_score = Math.round(
    semanticScore * 0.7 + parsed.match_score * 0.3
  );

  console.log("✅ Final hybrid match score:", parsed.match_score);
  return parsed;
};

/* ================================
   AI ANALYSIS (VISION FALLBACK)
================================ */
const analyzeVision = async (pdfBase64, jobDescription) => {
  console.log("🤖 AI VISION ANALYSIS START");

  const prompt = `
You are an ATS resume evaluator.

JOB DESCRIPTION:
${jobDescription}

Return ONLY JSON:
{
  "match_score": 0-100,
  "missing_keywords": [],
  "strengths": [],
  "weaknesses": []
}
`;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
  ]);

  const raw = result.response.text();
  console.log("🧠 AI RAW RESPONSE:", raw.slice(0, 200), "...");

  return parseAIJson(raw);
};

/* ================================
   JSON SAFE PARSER
================================ */
const parseAIJson = (text) => {
  console.log("🔍 Parsing AI JSON...");
  const clean = text.replace(/```json|```/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON found in AI response");
  }

  const parsed = JSON.parse(clean.slice(start, end + 1));

  parsed.match_score = Math.max(0, Math.min(100, Number(parsed.match_score) || 0));
  parsed.missing_keywords ||= [];
  parsed.strengths ||= [];
  parsed.weaknesses ||= [];

  console.log("✅ JSON parsed successfully");
  return parsed;
};

/* ================================
   MAIN ENDPOINT
================================ */
app.post("/evaluate", upload.single("file"), async (req, res) => {
  let filePath = null;

  try {
    console.log("🚀 /evaluate called");

    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
    if (!req.body.job_description)
      return res.status(400).json({ error: "Job description missing" });

    filePath = req.file.path;

    try {
      const text = await extractTextFromPDF(filePath);
      const result = await analyzeText(text, req.body.job_description);
      return res.json({ success: true, result, mode: "text+semantic" });
    } catch (err) {
      console.warn("⚠️ Text analysis failed:", err.message);
      const base64 = pdfToBase64(filePath);
      const result = await analyzeVision(base64, req.body.job_description);
      return res.json({ success: true, result, mode: "vision" });
    }
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🧹 Cleaned upload");
    }
  }
});

/* ================================
   TEST AI
================================ */
app.get("/test-ai", async (_, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const r = await model.generateContent("Reply ONLY with OK");
    res.json({ ok: r.response.text().trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   HEALTH
================================ */
app.get("/health", (_, res) => {
  res.json({
    status: "OK",
    model: MODEL_NAME,
    uptime: process.uptime(),
  });
});

/* ================================
   START
================================ */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/health`);
  console.log(`🤖 Test AI: http://localhost:${PORT}/test-ai`);
});
