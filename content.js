chrome.runtime.sendMessage(
  { action: "analyze", text: document.body.innerText },
  (res) => {
    const { risk, summary } = res;

    // Display as popup badge
    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;
      background: ${risk === "high" ? "#ff4d4d" : risk === "medium" ? "#ffa500" : "#5cd65c"};
      color: white; padding: 10px; text-align: center; font-size: 16px; font-weight: bold;
    `;
    banner.innerText = `⚠️ ${summary}`;
    document.body.prepend(banner);

    // Optional: highlight risky words
    const keywords = [
      "third[- ]?part(y|ies)",
      "data (sharing|retention|collection)",
      "location data",
      "binding arbitration",
      "waive.*right.*sue"
    ];
    const regex = new RegExp(keywords.join("|"), "gi");

    document.querySelectorAll("p, li, span").forEach(el => {
      if (regex.test(el.textContent)) {
        el.style.backgroundColor = "#ffdddd";
        el.title = "⚠️ Potential risky clause";
      }
    });
  }
);




