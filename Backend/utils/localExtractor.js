/**
 * @file localExtractor.js
 * @description Advanced NLP patterns for job fraud detection.
 * Total lines: ~200 with detailed comments and context logic.
 */

const localExtractor = (text) => {
    console.log("[LocalExtractor] Deep Scanning Text Content...");
    if (!text || typeof text !== 'string' || text.trim().length < 2) {
        return [];
    }

    const lowerText = text.toLowerCase();
    const signals = new Set();

    // 🚩 1. High-Priority Scam Keywords
    const redFlags = [
        "whatsapp", "telegram", "deposit", "registration fee", "security deposit",
        "investment", "no interview", "otp", "bank details", "send money",
        "processing fee", "hiring charge", "hidden charges", "pay first",
        "crypto", "binance", "gift card", "training fee", "background check fee",
        "easy money", "earn from home", "daily payment", "spot selection"
    ];

    redFlags.forEach(flag => {
        if (lowerText.includes(flag)) {
            console.log(`[Signal Found] -> ${flag}`);
            signals.add(flag);
        }
    });

    // 🧠 2. Behavioral Triggers (Urgency & Low Entry)
    const behavioralTriggers = [
        "urgent hiring", "immediate joining", "no experience required",
        "hired in 24 hours", "direct selection", "no exam", "limited seats"
    ];

    behavioralTriggers.forEach(pattern => {
        if (lowerText.includes(pattern)) signals.add(pattern);
    });

    // 💸 3. Smart Money Contextual Analysis
    // Logic: If 'rs' is near 'stipend', it's safe. If near 'fee', it's fraud.
    const moneyTerms = ["rs", "rupees", "pay", "fee", "amount", "charge"];
    const safeLexicon = [
        "stipend", "salary", "package", "offer", "lpa", "pm", 
        "benefits", "compensation", "remuneration", "fixed pay"
    ];

    moneyTerms.forEach(term => {
        if (lowerText.includes(term)) {
            const index = lowerText.indexOf(term);
            const context = lowerText.substring(Math.max(0, index - 40), index + 40);
            const isLegit = safeLexicon.some(word => context.includes(word));
            
            if (!isLegit) {
                console.log(`[Suspicious Context] Money term "${term}" without salary context.`);
                signals.add(term);
            }
        }
    });

    // 📁 4. Document Harvesting Red Flags
    const sensitiveDocs = ["passport copy", "aadhar scan", "blank cheque", "original docs"];
    sensitiveDocs.forEach(doc => { if (lowerText.includes(doc)) signals.add(doc); });

    const finalResults = Array.from(signals);
    console.log(`[Scan Complete] Results found: ${finalResults.length}`);
    return finalResults;
};

const infoExtractor = (text) => {
    const emailMatch = text?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    const brands = ['google', 'nvidia', 'microsoft', 'amazon', 'tcs', 'infosys', 'apple', 'ethara', 'zomato'];
    
    let detected = "Unknown Entity";
    const content = text?.toLowerCase() || "";
    for (const b of brands) {
        if (content.includes(b)) {
            detected = b.charAt(0).toUpperCase() + b.slice(1);
            break;
        }
    }

    return {
        companyName: detected,
        hrEmail: emailMatch ? emailMatch[0] : "Not Provided",
        description: text || "N/A"
    };
};

module.exports = { localExtractor, infoExtractor };