import { useState, useEffect, useRef } from "react";

export default function App() {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { id: 1, text: "Hello! I'm FraudShield AI. Provide details as: Company: [name], Description: [info]", sender: "bot" },
  ]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll logic for chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  // Helper: Extracting data from string
  const parseMessage = (msg) => {
    const companyMatch = msg.match(/Company:\s*([^,]+)/i);
    const descMatch = msg.match(/Description:\s*(.+)/i);
    return {
      companyName: companyMatch ? companyMatch[1].trim() : "Unknown",
      description: descMatch ? descMatch[1].trim() : msg.trim(),
    };
  };

  const handleSend = async () => {
  if (!message.trim()) return;

  const userMsg = message;
  setChatMessages(prev => [...prev, { id: Date.now(), text: userMsg, sender: "user" }]);
  setMessage("");
  setIsLoading(true);

  try {
    // Parse the message to extract company name and description
    const parsed = parseMessage(userMsg);
    
    // Use /chat endpoint for Google search + ML-based fraud detection
    const endpoint = 'chat';
    const payload = {
      companyName: parsed.companyName,
      message: parsed.description
    };

    const res = await fetch(`http://localhost:5001/api/company/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();

    // Update the analysis result with ML prediction
    const finalScore = data.riskScore ?? data.fraudScore ?? 0;
    const finalRisk = data.riskLevel ?? (finalScore > 50 ? "High" : "Low");
    setAnalysisResult({ ...data, riskScore: finalScore, riskLevel: finalRisk });
    
    setChatMessages(prev => [...prev, { 
      id: Date.now() + 1, 
      text: `✅ ML Analysis Complete! \nRisk Score: ${finalScore}% \nRisk Level: ${finalRisk}\n${data.insight || ""}`, 
      sender: "bot" 
    }]);

  } catch (error) {
    console.error("Full Error Details:", error);
    setChatMessages(prev => [...prev, { 
      id: Date.now() + 1, 
      text: "❌ Connection Error. Backend 5001 par check karein ya Console dekhein.", 
      sender: "bot" 
    }]);
  } finally {
    setIsLoading(false);
  }
};
  // UI Components logic for Gauges
  const score = analysisResult?.riskScore || 0;
  const strokeColor = score > 70 ? "#ef4444" : score > 40 ? "#f59e0b" : "#10b981";

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* CHAT SECTION */}
        <div className="lg:col-span-1 bg-slate-900/50 border border-white/10 rounded-3xl flex flex-col h-[85vh] shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              FraudShield Live AI
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                  msg.sender === 'user' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-slate-800 border border-white/5'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 items-center text-slate-500 text-xs">
                <div className="flex gap-1"><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div>
                Processing Security Protocols
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-slate-800/50 space-y-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Company: Apple, Description: Hiring..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <button onClick={handleSend} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-transform active:scale-95">
              Analyze Now
            </button>
          </div>
        </div>

        {/* DASHBOARD SECTION */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* RISK GAUGE CARD */}
          <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-10">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle 
                  cx="96" cy="96" r="88" fill="transparent" 
                  stroke={strokeColor} strokeWidth="12" 
                  strokeDasharray={553} 
                  strokeDashoffset={553 - (553 * score) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black">{score}%</span>
                <span className="text-xs uppercase text-slate-400 tracking-widest">Risk Level</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="inline-block px-4 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium">
                Real-time Assessment Status
              </div>
              <h2 className="text-3xl font-bold">
                {score > 70 ? "🚩 High Danger Detected" : score > 40 ? "⚠️ Suspicious Activity" : "✅ Verification Success"}
              </h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                Our AI has cross-referenced the provided description with 50+ known recruitment scam patterns including domain spoofing and financial extraction tactics.
              </p>
            </div>
          </div>

          {/* INSIGHTS CARD */}
          <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 flex-1">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-blue-500">🔍</span> Deep Scan Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">AI Logical Reasoning</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {analysisResult?.insight || analysisResult?.geminiInsights || "Waiting for data analysis to generate forensic report..."}
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Red Flags Triggered</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult?.keywords?.length > 0 ? analysisResult.keywords.map((k, i) => (
                    <span key={i} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-bold uppercase">
                      {k}
                    </span>
                  )) : (
                    <p className="text-xs text-slate-600 italic">No critical flags detected in current session.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}