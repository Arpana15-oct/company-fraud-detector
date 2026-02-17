const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const { analyzeCompany, researchCompany, extractCompanySignals } = require("../utils/Gemini.js");
const { localExtractor, infoExtractor } = require("../utils/localExtractor.js");
const { scrapeJobs } = require("../utils/scraper.js");

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to extract text from uploaded file
async function extractTextFromFile(filePath, mimeType) {
  try {
    // Handle PDF files
    if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    }
    
    // Handle image files (PNG, JPG, JPEG) using Tesseract.js
    if (mimeType && mimeType.startsWith('image/')) {
      const Tesseract = require('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
      return text;
    }
    
    // If it's a text file
    if (mimeType === 'text/plain' || filePath.endsWith('.txt')) {
      return fs.readFileSync(filePath, 'utf8');
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting text from file:", error);
    return null;
  }
}

// Helper function to extract features from company data
async function extractFeatures(companyName, description) {
  const lowerDesc = (description || "").toLowerCase();
  
  // Extract signals using local extractor
  const signals = localExtractor(description || "");
  const signalCount = signals.length;
  
  // Extract info using info extractor
  const info = infoExtractor(description || "");
  
  // Scrape job sites for company presence
  const jobData = await scrapeJobs(companyName);
  
  // Feature extraction based on description and available data
  // Feature order must match CSV columns and predict.py:
  // hasUrgent, noInterview, quickMoney, keywordCount, domainMismatch, 
  // foundOnLinkedIn, jobsOnIndeed, foundOnNaukri, totalJobs
  
  const features = {
    // hasUrgent: Check for urgent hiring keywords
    hasUrgent: lowerDesc.includes("urgent") || lowerDesc.includes("immediate") || 
                lowerDesc.includes("hiring now") || lowerDesc.includes("apply now") ? 1 : 0,
    
    // noInterview: Check for no interview indicators
    noInterview: lowerDesc.includes("no interview") || lowerDesc.includes("without interview") ||
                  lowerDesc.includes("direct selection") ? 1 : 0,
    
    // quickMoney: Check for money-related red flags
    quickMoney: lowerDesc.includes("easy money") || lowerDesc.includes("earn from home") ||
                 lowerDesc.includes("daily payment") || lowerDesc.includes("quick money") ||
                 lowerDesc.includes("investment") ? 1 : 0,
    
    // keywordCount: Number of red flag signals found
    keywordCount: signalCount,
    
    // domainMismatch: Check if company name and email domain don't match (basic check)
    domainMismatch: (info.hrEmail !== "Not Provided" && companyName) ? 
                    (info.hrEmail.includes(companyName.toLowerCase().replace(/\s+/g, '')) ? 0 : 1) : 0,
    
    // foundOnLinkedIn: From job scrape data
    foundOnLinkedIn: jobData.foundOnLinkedIn ? 1 : 0,
    
    // jobsOnIndeed: From job scrape data (treat indeed as jobs count)
    jobsOnIndeed: jobData.foundOnIndeed ? Math.min(jobData.totalResults || 1, 10) : 0,
    
    // foundOnNaukri: From job scrape data
    foundOnNaukri: jobData.foundOnNaukri ? 1 : 0,
    
    // totalJobs: Total jobs found
    totalJobs: jobData.totalResults || 0
  };
  
  return features;
}

// Helper function to call Python predict.py
function runPrediction(features, companyName) {
  return new Promise((resolve, reject) => {
    const featureArray = [
      features.hasUrgent,
      features.noInterview,
      features.quickMoney,
      features.keywordCount,
      features.domainMismatch,
      features.foundOnLinkedIn,
      features.jobsOnIndeed,
      features.foundOnNaukri,
      features.totalJobs
    ];
    
    const args = [...featureArray.map(String), companyName];
    const pythonProcess = spawn("python", ["predict.py", ...args], {
      cwd: path.join(__dirname, "..")
    });
    
    let result = "";
    let error = "";
    
    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on("data", (data) => {
      error += data.toString();
    });
    
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python prediction error:", error);
        reject(new Error(error || "Prediction failed"));
      } else {
        try {
          const parsed = JSON.parse(result.trim());
          resolve(parsed);
        } catch (e) {
          console.error("Failed to parse Python output:", result);
          reject(new Error("Invalid prediction output"));
        }
      }
    });
  });
}

// Predict endpoint - for ML-based fraud detection using trained model
router.post("/predict", async (req, res) => {
  try {
    const { companyName, description } = req.body;
    
    if (!companyName) {
      return res.status(400).json({ 
        success: false,
        error: "Company name is required" 
      });
    }
    
    console.log(`[Predict] Processing: ${companyName}`);
    
    // Extract features from company data
    const features = await extractFeatures(companyName, description);
    console.log("[Predict] Features extracted:", features);
    
    // Run ML prediction
    const prediction = await runPrediction(features, companyName);
    console.log("[Predict] ML Prediction:", prediction);
    
    // Combine with signal analysis
    const signals = extractCompanySignals(description || "");
    
    // Return combined result
    const response = {
      success: true,
      company: companyName,
      riskScore: Math.round((prediction.probability || 0) * 100),
      riskLevel: prediction.risk_level || "Low",
      probability: prediction.probability || 0,
      insight: `ML Model Confidence: ${Math.round((prediction.probability || 0) * 100)}%. ${signals.length > 0 ? `Found ${signals.length} warning signals.` : "No additional warning signals detected."}`,
      keywords: signals,
      features: features,
      mlAnalysis: prediction
    };
    
    res.json(response);
  } catch (error) {
    console.error("Predict Error:", error);
    res.status(500).json({ 
      success: false,
      error: "Prediction failed: " + error.message,
      riskScore: 50,
      riskLevel: "Medium"
    });
  }
});

// Analyze endpoint - for structured data (Company: [name], Description: [info])
router.post("/analyze", async (req, res) => {
  try {
    const { companyName, description } = req.body;
    const result = await analyzeCompany(companyName, description);
    res.json(result);
  } catch (error) {
    console.error("Analyze Error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Chat endpoint - for simple chat messages with Google search + ML prediction
router.post("/chat", async (req, res) => {
  try {
    const { message, companyName } = req.body;
    
    // If no specific company name, try to extract from message
    const name = companyName || message || "Unknown";
    const description = message || "";
    
    console.log(`[Chat] Processing: ${name}`);
    console.log(`[Chat] Description: ${description}`);
    
    // Step 1: Extract features and run ML prediction
    const features = await extractFeatures(name, description);
    console.log("[Chat] Features extracted:", features);
    
    // Step 2: Run ML prediction
    const mlPrediction = await runPrediction(features, name);
    console.log("[Chat] ML Prediction:", mlPrediction);
    
    // Step 3: Use researchCompany for Google search + Gemini analysis
    const researchResult = await researchCompany(name, description);
    console.log("[Chat] Research completed:", researchResult.success ? "Success" : "Failed");
    
    // Combine ML prediction with research results
    const mlScore = Math.round((mlPrediction.probability || 0) * 100);
    const mlRiskLevel = mlPrediction.risk_level || "Low";
    
    // Get signals from research
    const signals = researchResult.signals || [];
    
    // Determine final risk score combining ML and research
    let finalRiskScore = mlScore;
    let finalRiskLevel = mlRiskLevel;
    let insight = "";
    
    // If Gemini provided analysis, use it
    if (researchResult.geminiAnalysis) {
      // Combine ML score with Gemini score (average)
      const geminiScore = researchResult.geminiAnalysis.riskScore || mlScore;
      finalRiskScore = Math.round((mlScore + geminiScore) / 2);
      finalRiskLevel = finalRiskScore > 70 ? "High" : finalRiskScore > 40 ? "Medium" : "Low";
      
      insight = `ML Model: ${mlScore}%. Google Search Analysis: ${geminiScore}%. ${researchResult.geminiAnalysis.insight || ""}`;
    } else {
      insight = `ML Model Confidence: ${mlScore}%. ${signals.length > 0 ? `Found ${signals.length} warning signals from description.` : "No additional warning signals detected."}`;
    }
    
    // Return combined result
    const response = {
      success: true,
      response: insight,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      insight: insight,
      keywords: researchResult.geminiAnalysis?.warnings || signals,
      features: features,
      mlAnalysis: mlPrediction,
      googleSearch: researchResult.searchResults?.success ? true : false,
      googleResultsCount: researchResult.searchResults?.results?.length || 0
    };
    
    console.log("[Chat] Final response:", response);
    res.json(response);
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ 
      success: false,
      response: "Analysis failed. Please try again.",
      error: "Chat analysis failed: " + error.message,
      riskScore: 50,
      riskLevel: "Medium"
    });
  }
});

// Upload endpoint - for uploading offer letters and other documents
router.post("/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    console.log(`[Upload] Processing file: ${req.file.originalname}`);
    
    // Extract text from the uploaded file
    const extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
    
    if (!extractedText) {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: "Could not extract text from file. Please upload a PDF, image, or text file."
      });
    }

    console.log(`[Upload] Extracted text length: ${extractedText.length} characters`);
    
    // Extract company info from the extracted text
    const info = infoExtractor(extractedText);
    const companyName = info.companyName !== "Unknown Entity" ? info.companyName : "Unknown Company";
    
    // Extract features and run ML prediction
    const features = await extractFeatures(companyName, extractedText);
    const prediction = await runPrediction(features, companyName);
    
    // Also get signal analysis
    const signals = extractCompanySignals(extractedText);
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    // Return the result
    const response = {
      success: true,
      company: companyName,
      riskScore: Math.round((prediction.probability || 0) * 100),
      riskLevel: prediction.risk_level || "Low",
      probability: prediction.probability || 0,
      insight: `ML Model Confidence: ${Math.round((prediction.probability || 0) * 100)}%. Analyzed document text (${extractedText.length} chars). Found ${signals.length} warning signals.`,
      keywords: signals,
      features: features,
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? "..." : ""),
      mlAnalysis: prediction
    };
    
    res.json(response);
  } catch (error) {
    console.error("Upload Error:", error);
    // Clean up the uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    res.status(500).json({
      success: false,
      error: "File analysis failed: " + error.message,
      riskScore: 50,
      riskLevel: "Medium"
    });
  }
});

module.exports = router;

