import { HF_API_TOKEN } from "./config.js";
const HF_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";

const POLICY_KEYWORDS = [
  "privacy policy", "terms of service", "terms and conditions",
  "user agreement", "data protection", "GDPR", "CCPA"
];

// Detect whether the page has a policy
function hasPolicyText(text) {
  if (!text || typeof text !== "string" || text.length < 300) return false;
  return POLICY_KEYWORDS.filter(kw =>
    new RegExp(`\\b${kw}\\b`, "i").test(text)
  ).length >= 2;
}

// Extract relevant snippets
function extractRelevantSnippets(text, label) {
  const patterns = {
    "Third-Party Sharing": [
      /\b(share|disclose|provide)s?\b.{0,50}\b(to|with|third[\s-]party|partner|vendor|service provider)\b/i,
      /\b(data|information|personal data)\b.{0,50}\b(shared|disclosed|provided)\b.{0,50}\b(to|third[\s-]party)\b/i
    ],
    "User Rights": [
      /\b(rights?|may|can)\b.{0,50}\b(access|delete|correct|rectify|modify|request|opt[\s-]out)\b/i,
      /\b(you|user)\b.{0,50}\b(request|access|delete|remove)\b.{0,50}\b(data|information)\b/i
    ],
    "Data Retention": [
      /\b(retain|store|keep|hold)\b.{0,50}\b(data|information)\b.{0,50}\b(for|period|time|duration)\b/i,
      /\b(data|information)\b.{0,50}\b(retention|storage)\b.{0,50}\b(policy|period|duration)\b/i
    ]
  }[label] || [];

  const sentences = text.split(/[.!?]\s+/).map(s => s.trim()).filter(Boolean);
  const relevant = [];

  for (const sentence of sentences) {
    for (const pattern of patterns) {
      if (pattern.test(sentence)) {
        relevant.push(sentence.endsWith(".") ? sentence : sentence + ".");
        break;
      }
    }
  }

  return [...new Set(relevant)].slice(0, 3); // unique, max 3
}

// Get description for clauses
function getDescriptionForLabel(label) {
  const descriptions = {
    "Data Collection": "What personal information is collected",
    "Third-Party Sharing": "Whether data is shared with third parties",
    "User Rights": "Your rights regarding your personal data",
    "Data Retention": "How long your data is stored"
  };
  return descriptions[label] || "Important policy clause";
}

// Hugging Face API analysis
async function analyzeWithHF(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: text.substring(0, 2000),
        parameters: {
          candidate_labels: ["Data Collection", "Third-Party Sharing", "User Rights", "Data Retention"],
          multi_label: true
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    console.error("Analysis Error:", error);
    return { error: error.message };
  }
}

// Unified message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "check-policy") {
    const hasPolicy = hasPolicyText(request.text);
    sendResponse({ hasPolicy });
    return true;
  }

  if (request.action === "analyze-policy") {
    analyzeWithHF(request.text).then(data => {
      if (data.error) {
        sendResponse({ error: data.error });
        return;
      }

      if (!data || !data.labels || !data.scores) {
        sendResponse({ error: "No valid analysis returned" });
        return;
      }

      const keyClauses = data.labels.map((label, idx) => ({
        name: label,
        confidence: Math.round(data.scores[idx] * 100),
        description: getDescriptionForLabel(label),
        snippets: extractRelevantSnippets(request.text, label)
      }))
      .filter(c => c.confidence > 50); // filter weak matches

      sendResponse({ keyClauses });
    });
    return true; // async
  }
});
