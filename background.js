import { HF_API_TOKEN } from "./config.js";

const HF_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";

// Check if text contains policy content
function hasPolicyText(text) {
  const policyKeywords = [
    "terms of service", "terms and conditions", "privacy policy",
    "user agreement", "license agreement", "terms of use",
    "data collection", "cookies policy", "GDPR", "CCPA"
  ];
  return policyKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
}

// Analyze policy text with Hugging Face API
async function analyzeWithHF(text) {
  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: text.substring(0, 2000), // Limit to first 2000 chars
        parameters: {
          candidate_labels: [
            "Data Collection",
            "Third-Party Sharing", 
            "User Rights",
            "Data Retention",
            "Liability Limitations",
            "Governing Law"
          ]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Hugging Face API Error:", error);
    return null;
  }
}

// Process API results into readable format
function processHFResults(results) {
  if (!results || !results.labels) return null;
  
  return results.labels.map((label, index) => ({
    label,
    score: results.scores[index]
  })).sort((a, b) => b.score - a.score);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "check-policy") {
    const hasPolicy = hasPolicyText(request.text);
    sendResponse({ hasPolicy });
  }
  
  if (request.action === "analyze-policy") {
    analyzeWithHF(request.text).then(hfResults => {
      const processed = processHFResults(hfResults);
      
      if (!processed) {
        sendResponse({ error: "Failed to analyze policy" });
        return;
      }
      
      // Get top 3 most relevant clauses
      const keyClauses = processed.slice(0, 3).map(item => ({
        name: item.label,
        confidence: Math.round(item.score * 100),
        description: getDescriptionForLabel(item.label)
      }));
      
      sendResponse({ keyClauses });
    });
    
    return true; // Required for async response
  }
});

function getDescriptionForLabel(label) {
  const descriptions = {
    "Data Collection": "What personal information the service collects",
    "Third-Party Sharing": "Whether your data is shared with other companies",
    "User Rights": "Your rights to access or delete your data",
    "Data Retention": "How long your data is kept",
    "Liability Limitations": "Limits on the service's responsibility",
    "Governing Law": "Which country's laws apply to disputes"
  };
  return descriptions[label] || "Important policy clause";
}
