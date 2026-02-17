const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration - try multiple models in order of preference
const MODEL_CONFIG = {
  models: [
    { name: "gemini-2.0-flash", version: "v1" },
    { name: "gemini-1.5-flash-8b", version: "v1" },
    { name: "gemini-1.5-flash", version: "v1" },
    { name: "gemini-pro", version: "v1" }
  ]
};

async function checkModels() {
  console.log("Checking available Gemini models...\n");
  
  for (const modelConfig of MODEL_CONFIG.models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelConfig.name });
      // Try a simple generation to verify the model works
      const result = await model.generateContent("Hello");
      console.log(`${modelConfig.name} is available ✅ (API: ${modelConfig.version})`);
    } catch (err) {
      console.log(`${modelConfig.name} NOT available ❌ : ${err.message}`);
    }
  }
}

checkModels();
