document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultContainer = document.getElementById('resultContainer');

  analyzeBtn.addEventListener('click', async () => {
    resultContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Analyzing page content...
      </div>
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });

      const policyCheck = await chrome.runtime.sendMessage({
        action: "check-policy",
        text: result.result
      });

      if (!policyCheck?.hasPolicy) {
        resultContainer.innerHTML = `
          <div class="no-policy">
            No privacy policy detected on this page.
          </div>
        `;
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: "analyze-policy",
        text: result.result
      });

      if (response.error) {
        resultContainer.innerHTML = `
          <div class="error">
            ${response.error}
          </div>
        `;
        return;
      }

      if (!response.keyClauses?.length) {
        resultContainer.innerHTML = `
          <div class="no-risk">
            No risky clauses found in this policy.
          </div>
        `;
        return;
      }

      resultContainer.innerHTML = `
        <div class="analysis-results">
          <div class="results-header">
            AI Analysis Results
          </div>
          ${response.keyClauses.map(clause => `
            <div class="clause">
              <div class="clause-title">
                ${clause.name}
                <span class="confidence">${clause.confidence}%</span>
              </div>
              <div class="clause-desc">${clause.description}</div>
              ${clause.snippets.length ? `
              <div class="snippets">
                <div class="snippets-title">Relevant excerpts:</div>
                ${clause.snippets.map(s => `<div class="snippet">"${s}"</div>`).join('')}
              </div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      resultContainer.innerHTML = `
        <div class="error">
          Error: ${error.message}
        </div>
      `;
    }
  });
});
