const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration - try multiple models in order of preference
const MODEL_CONFIG = {
  models: [
    { name: "gemini-2.0-flash", version: "v1" },
    { name: "gemini-1.5-flash-8b", version: "v1" },
    { name: "gemini-1.5-flash", version: "v1" },
    { name: "gemini-pro", version: "v1" }
  ],
  currentIndex: 0
};

// Helper function to check if error is a quota error
function isQuotaError(error) {
  const errorMsg = error.message || "";
  return errorMsg.includes("429") || 
         errorMsg.includes("quota") || 
         errorMsg.includes("exceeded") ||
         errorMsg.includes("rate limit") ||
         errorMsg.includes("billing");
}

// Helper function to get retry delay from error
function getRetryDelay(error) {
  const match = error.message?.match(/retry in (\d+\.?\d*)s/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return 30; // default 30 seconds
}

// Helper function to get the current model
function getModel() {
  const modelConfig = MODEL_CONFIG.models[MODEL_CONFIG.currentIndex];
  console.log(`[Gemini] Using model: ${modelConfig.name} with API version: ${modelConfig.version}`);
  return genAI.getGenerativeModel({ 
    model: modelConfig.name,
    generationConfig: {
      temperature: 0.9,
      topP: 1,
      topK: 1,
      maxOutputTokens: 2048,
    }
  });
}

// Helper function to try next model if current one fails
function tryNextModel(error) {
  // Don't try next model for quota errors - they will fail too
  if (isQuotaError(error)) {
    console.log("[Gemini] Quota error detected - not trying next model");
    return false;
  }
  
  if (MODEL_CONFIG.currentIndex < MODEL_CONFIG.models.length - 1) {
    MODEL_CONFIG.currentIndex++;
    console.log(`[Gemini] Trying next model: ${MODEL_CONFIG.models[MODEL_CONFIG.currentIndex].name}`);
    return true;
  }
  console.error("[Gemini] All models failed:", error.message);
  return false;
}

//  High-Priority Scam Keywords for fraud detection
const RED_FLAGS = [
    "whatsapp", "telegram", "deposit", "registration fee", "security deposit",
    "investment", "no interview", "otp", "bank details", "send money",
    "processing fee", "hiring charge", "hidden charges", "pay first",
    "crypto", "binance", "gift card", "training fee", "background check fee",
    "easy money", "earn from home", "daily payment", "spot selection"
];

//  Behavioral Triggers (urgency & low entry barriers)
const BEHAVIORAL_TRIGGERS = [
    "urgent hiring", "immediate joining", "no experience required",
    "hired in 24 hours", "direct selection", "no exam", "limited seats"
];

//  Money terms to check for suspicious context
const MONEY_TERMS = ["rs", "rupees", "pay", "fee", "amount", "charge"];

// Safe lexicon - if these appear near money terms, it's likely legitimate
const SAFE_LEXICON = [
    "stipend", "salary", "package", "offer", "lpa", "pm", 
    "benefits", "compensation", "remuneration", "fixed pay"
];

//  Document harvesting red flags
const SENSITIVE_DOCS = ["passport copy", "aadhar scan", "blank cheque", "original docs"];

// Known legitimate brands
const KNOWN_BRANDS = ['google', 'nvidia', 'microsoft', 'amazon', 'apple', 'meta', 'tcs', 'infosys', 'zomato', 'flipkart'];

/**
 * Extract fraud signals from company description text
 * @param {string} text - Company description text
 * @returns {Array} - Array of detected signals/keywords
 */
const extractCompanySignals = (text) => {
    console.log("[Gemini] Extracting Company Signals...");
    if (!text || typeof text !== 'string' || text.trim().length < 2) {
        return [];
    }

    const lowerText = text.toLowerCase();
    const signals = new Set();

    //  1. High-Priority Scam Keywords
    RED_FLAGS.forEach(flag => {
        if (lowerText.includes(flag)) {
            console.log(`[Signal Found] -> ${flag}`);
            signals.add(flag);
        }
    });

    //  2. Behavioral Triggers
    BEHAVIORAL_TRIGGERS.forEach(pattern => {
        if (lowerText.includes(pattern)) signals.add(pattern);
    });

    // 3. Smart Money Contextual Analysis
    MONEY_TERMS.forEach(term => {
        if (lowerText.includes(term)) {
            const index = lowerText.indexOf(term);
            const context = lowerText.substring(Math.max(0, index - 40), index + 40);
            const isLegit = SAFE_LEXICON.some(word => context.includes(word));
            
            if (!isLegit) {
                console.log(`[Suspicious Context] Money term "${term}" without salary context.`);
                signals.add(term);
            }
        }
    });

    //  4. Document Harvesting Red Flags
    SENSITIVE_DOCS.forEach(doc => { 
        if (lowerText.includes(doc)) signals.add(doc); 
    });

    const finalResults = Array.from(signals);
    console.log(`[Signals Extracted] Total: ${finalResults.length}`);
    return finalResults;
};

/**
 * Extract company information from text
 * @param {string} text - Company description text
 * @returns {Object} - Object with companyName, hrEmail, description
 */
const extractCompanyInfoFromText = (text) => {
    console.log("[Gemini] Extracting Company Info...");
    
    // Extract email from text
    const emailMatch = text?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    
    // Detect known brands
    let detected = "Unknown Entity";
    const content = text?.toLowerCase() || "";
    for (const brand of KNOWN_BRANDS) {
        if (content.includes(brand)) {
            detected = brand.charAt(0).toUpperCase() + brand.slice(1);
            break;
        }
    }

    return {
        companyName: detected,
        hrEmail: emailMatch ? emailMatch[0] : "Not Provided",
        description: text || "N/A"
    };
};

/**
 * Search Google for company information using multiple approaches
 * @param {string} companyName - Company name to search
 * @returns {Object} - Search results with snippets
 */
const searchGoogle = async (companyName) => {
    console.log(`[Google Search] Searching for: ${companyName}`);
    
    // First try: Direct Google search with improved parsing
    try {
        const searchQueries = [
            `${companyName} company reviews`,
            `${companyName} scam`,
            `${companyName} fraud`,
            `${companyName} complaints`
        ];
        
        const allResults = [];
        
        for (const query of searchQueries) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Try multiple selectors for Google search results
            const selectors = [
                'div.g',
                'div[data-sokoban-container]',
                'div[data-hveid]',
                '.BNeawe.vRIPje'
            ];
            
            for (const selector of selectors) {
                $(selector).each((i, el) => {
                    if (allResults.length >= 10) return;
                    
                    const title = $(el).find('h3').text() || $(el).find('.DKV0Md').text() || '';
                    const snippet = $(el).find('.VwiC3b').text() || $(el).find('.st').text() || '';
                    const link = $(el).find('a').attr('href') || '';
                    
                    if (title || snippet) {
                        allResults.push({ 
                            title: title.trim(), 
                            snippet: snippet.trim(),
                            query 
                        });
                    }
                });
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Remove duplicates
        const uniqueResults = [];
        const seen = new Set();
        for (const result of allResults) {
            const key = result.title.toLowerCase();
            if (!seen.has(key) && result.title.trim()) {
                seen.add(key);
                uniqueResults.push(result);
            }
        }
        
        console.log(`[Google Search] Found ${uniqueResults.length} results`);
        return {
            success: true,
            results: uniqueResults.slice(0, 10),
            companyName
        };
    } catch (error) {
        console.error(`[Google Search] Error: ${error.message}`);
        
        // Check if it's a rate limit error
        if (error.response && error.response.status === 429) {
            console.log("[Google Search] Rate limited - will use local analysis only");
        }
        
        // Fallback: Use Gemini to generate search context
        try {
            console.log("[Google Search] Using Gemini as fallback for company research...");
            const model = getModel();
            
            const prompt = `Research about ${companyName} company. Provide information about:
            1. Is this company legitimate?
            2. Any scam reports or complaints?
            3. Company reputation and reviews
            
            Return a summary with key findings.`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return {
                success: true,
                results: [{
                    title: `AI Research: ${companyName}`,
                    snippet: text.substring(0, 1000)
                }],
                companyName,
                isAIFallback: true
            };
        } catch (geminiError) {
            // Check for quota error
            if (isQuotaError(geminiError)) {
                const retryDelay = getRetryDelay(geminiError);
                console.error(`[Google Search] Gemini API quota exceeded. Retry after ${retryDelay} seconds.`);
                console.error("[Google Search] Note: Get a paid API key from https://aistudio.google.com/app/apikey to avoid quota limits");
            } else {
                console.error(`[Google Search] Gemini fallback error: ${geminiError.message}`);
            }
            
            return {
                success: false,
                error: isQuotaError(geminiError) ? "API quota exceeded - please try again later or use a paid API key" : error.message,
                companyName,
                isQuotaError: isQuotaError(geminiError)
            };
        }
    }
};

/**
 * Analyze company using Gemini AI
 * @param {string} companyName - Company name
 * @param {string} description - Company description
 * @returns {Object} - Analysis results
 */
const analyzeCompany = async (companyName, description) => {
    try {
        const model = getModel();

        const prompt = `Analyze if this company is a scam. 
        Company Name: ${companyName}
        Description: ${description}
        Return JSON only: { "riskScore": (0-100), "riskLevel": "Low/Medium/High", "insight": "Reason", "keywords": ["bad", "scam"] }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        if (isQuotaError(error)) {
            console.error("[Gemini] API quota exceeded - returning default low risk response");
            return {
                riskScore: 0,
                riskLevel: "Low",
                insight: "API quota exceeded - using ML model only",
                keywords: []
            };
        }
        throw error;
    }
};

/**
 * Comprehensive company research - combines multiple sources
 * @param {string} companyName - Company name
 * @param {string} description - Company description
 * @returns {Object} - Comprehensive analysis
 */
const researchCompany = async (companyName, description) => {
    console.log(`[Research] Starting comprehensive research for: ${companyName}`);
    
    try {
        // Run multiple checks in parallel
        const [signals, info, searchResults] = await Promise.all([
            Promise.resolve(extractCompanySignals(description)),
            Promise.resolve(extractCompanyInfoFromText(description)),
            searchGoogle(companyName).catch(err => ({ 
                success: false, 
                error: err.message,
                isQuotaError: isQuotaError(err)
            }))
        ]);

        // Use Gemini for final analysis if we have search results
        let geminiAnalysis = null;
        if (searchResults.success && searchResults.results.length > 0) {
            try {
                const model = getModel();
                const searchContext = searchResults.results.map(r => `${r.title}: ${r.snippet}`).join('\n');
                
                const prompt = `Analyze if this company might be a scam based on search results:
                Company: ${companyName}
                Search Results:
                ${searchContext}
                
                Return JSON: { "riskScore": 0-100, "riskLevel": "Low/Medium/High", "insight": "brief explanation", "warnings": ["warning1"] }`;
                
                const result = await model.generateContent(prompt);
                geminiAnalysis = JSON.parse(result.response.text());
            } catch (e) {
                if (isQuotaError(e)) {
                    console.log("[Research] Gemini quota exceeded - skipping AI analysis");
                } else {
                    console.error("[Research] Gemini analysis error:", e.message);
                }
            }
        } else if (searchResults.isQuotaError) {
            console.log("[Research] Skipping AI analysis due to quota limits");
        }

        return {
            signals,
            info,
            searchResults,
            geminiAnalysis,
            companyName,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("[Research] Error:", error);
        return {
            error: error.message,
            companyName
        };
    }
};

module.exports = { 
    analyzeCompany,
    extractCompanySignals,
    extractCompanyInfoFromText,
    searchGoogle,
    researchCompany
};
