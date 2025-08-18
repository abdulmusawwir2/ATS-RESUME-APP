// AIzaSyAiIGKxVUQELFJkKD8n66Fd6dkfD2KkMMk
import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8000;

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Google AI
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY is required in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to extract text from PDF using pdftotext
const extractTextFromPDF = async (pdfPath) => {
  try {
    try {
      const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
      if (stdout && stdout.trim().length > 100) {
        console.log(stdout);
        console.log(`Extracted ${stdout.length} characters using pdftotext`);
        return stdout.trim();
      }
    } catch {
      console.log("pdftotext not available, trying fallback...");
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    let text = pdfBuffer.toString("utf8");
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    text = text.replace(/\s+/g, " ").trim();

    if (text.length < 50) {
      throw new Error("Unable to extract readable text from PDF");
    }

    console.log(`Extracted ${text.length} characters using fallback method`);
    return text;
  } catch (err) {
    console.error("PDF text extraction error:", err);
    throw new Error(
      "Failed to extract text from PDF. Please ensure the PDF contains selectable text (not just images)."
    );
  }
};

// Convert PDF to Base64
const convertPDFToBase64 = async (pdfPath) => {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64String = pdfBuffer.toString("base64");
    console.log(`PDF converted to base64, size: ${base64String.length}`);
    return base64String;
  } catch (err) {
    console.error("PDF to base64 conversion error:", err);
    throw new Error("Failed to process PDF file");
  }
};

// Text-based AI resume analysis
const analyzeResumeWithAI = async (resumeText, jobDescription) => {
  try {
    const prompt = `
You are an expert ATS (Applicant Tracking System) resume evaluator. Analyze the provided resume text against the given job description and provide a comprehensive evaluation.

JOB DESCRIPTION:
${jobDescription}

RESUME TEXT:
${resumeText}

Return ONLY a valid JSON object with this exact structure:
{
  "match_score": <integer 0-100>,
  "missing_keywords": [<array of missing keywords>],
  "strengths": [<array of strengths>],
  "weaknesses": [<array of weaknesses>]
}
`;

    console.log("Sending request to Google AI for analysis...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    if (!result.response) {
      throw new Error("No response from AI model");
    }

    let cleanedResponse = result.response.text().trim();
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    const firstBrace = cleanedResponse.indexOf("{");
    const lastBrace = cleanedResponse.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No valid JSON object found in AI response");
    }

    cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
    const parsedResult = JSON.parse(cleanedResponse);

    parsedResult.match_score = Math.max(
      0,
      Math.min(100, parseInt(parsedResult.match_score) || 0)
    );

    if (!parsedResult.missing_keywords.length) {
      parsedResult.missing_keywords = ["No significant missing keywords identified"];
    }
    if (!parsedResult.strengths.length) {
      parsedResult.strengths = ["Resume contains relevant content for the role"];
    }
    if (!parsedResult.weaknesses.length) {
      parsedResult.weaknesses = ["Consider adding more specific achievements and metrics"];
    }

    return parsedResult;
  } catch (error) {
    console.error("AI analysis error:", error);
    throw new Error("AI analysis failed: " + error.message);
  }
};

// Vision-based AI analysis (fallback)
const analyzeResumeWithAIVision = async (pdfBase64, jobDescription) => {
  try {
    const prompt = `
You are an expert ATS resume evaluator. Analyze this resume image against the job description below.

JOB DESCRIPTION:
${jobDescription}

Return ONLY a valid JSON object:
{
  "match_score": <0-100>,
  "missing_keywords": [<array>],
  "strengths": [<array>],
  "weaknesses": [<array>]
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    ]);

    let cleanedResponse = result.response.text().trim();
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    const firstBrace = cleanedResponse.indexOf("{");
    const lastBrace = cleanedResponse.lastIndexOf("}");
    cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);

    const parsedResult = JSON.parse(cleanedResponse);
    parsedResult.match_score = Math.max(
      0,
      Math.min(100, parseInt(parsedResult.match_score) || 0)
    );

    return parsedResult;
  } catch (error) {
    console.error("AI vision analysis error:", error);
    throw new Error("AI vision analysis failed: " + error.message);
  }
};

// Main evaluation endpoint
app.post("/evaluate", upload.single("file"), async (req, res) => {
  let uploadedFilePath = null;
  try {
    const { job_description } = req.body;
    if (!job_description || !job_description.trim()) {
      return res.status(400).json({ error: "Please provide a valid job description." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a PDF resume file." });
    }

    uploadedFilePath = req.file.path;
    console.log("Processing uploaded file:", req.file.originalname);

    let analysisResult;
    try {
      console.log("Attempting text extraction...");
      const resumeText = await extractTextFromPDF(uploadedFilePath);
      if (resumeText.length > 100) {
        console.log("Using text-based analysis");
        analysisResult = await analyzeResumeWithAI(resumeText, job_description.trim());
      } else {
        throw new Error("Insufficient text extracted");
      }
    } catch {
      console.log("Falling back to AI vision...");
      const pdfBase64 = await convertPDFToBase64(uploadedFilePath);
      analysisResult = await analyzeResumeWithAIVision(pdfBase64, job_description.trim());
    }

    res.json({ success: true, result: analysisResult, message: "Resume analyzed successfully!" });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      console.log("Cleaned up uploaded file");
    }
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ai_configured: !!process.env.GOOGLE_API_KEY,
  });
});

// AI connection test
app.get("/test-ai", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Reply with just 'AI Working' if you can read this.");
    res.json({ status: "AI connection successful", response: result.response.text().trim() });
  } catch (error) {
    res.status(500).json({ status: "AI connection failed", error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ error: "File upload error: " + err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler (Express 5+ compatible)
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Create uploads dir if not exists
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
  console.log("📁 Created uploads directory");
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI test: http://localhost:${PORT}/test-ai`);
});
