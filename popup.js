document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultContainer = document.getElementById('resultContainer');

  analyzeBtn.addEventListener('click', function() {
    // Show loading state
    resultContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Analyzing page content with AI...
      </div>
    `;
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: function() {
          return document.body.innerText;
        }
      }, function(results) {
        const pageText = results[0].result;
        
        // First check if policy exists
        chrome.runtime.sendMessage(
          { action: "check-policy", text: pageText },
          function(response) {
            if (!response.hasPolicy) {
              resultContainer.innerHTML = `
                <div class="no-policy">
                  No privacy policy or terms & conditions detected on this page.
                </div>
              `;
              return;
            }
            
            // If policy exists, analyze with Hugging Face
            chrome.runtime.sendMessage(
              { action: "analyze-policy", text: pageText },
              function(response) {
                if (response.error) {
                  resultContainer.innerHTML = `
                    <div class="error">
                      Analysis failed: ${response.error}<br><br>
                      Please try again later.
                    </div>
                  `;
                  return;
                }
                
                if (response.keyClauses.length === 0) {
                  resultContainer.innerHTML = `
                    <div class="no-policy">
                      Policy text found but no key clauses identified.
                    </div>
                  `;
                  return;
                }
                
                let clausesHTML = response.keyClauses.map(clause => `
                  <div class="clause">
                    <div class="clause-title">
                      ${clause.name}
                      <span class="clause-confidence">${clause.confidence}% confidence</span>
                    </div>
                    <div class="clause-desc">${clause.description}</div>
                      ${clause.snippets && clause.snippets.length > 0 ? `
                    <div class="clause-snippets">
                      <div class="snippets-title">Relevant excerpts:</div>
                      ${clause.snippets.map(snippet => `<div class="snippet">"${snippet}"</div>`).join('')}
                    </div>` : ''}
                  </div>
                `).join('');
                
                resultContainer.innerHTML = `
                  <div class="analysis-results">
                    <div class="results-header">
                      AI Analysis Results
                    </div>
                    ${clausesHTML}
                  </div>
                `;
              }
            );
          }
        );
      });
    });
  });
});