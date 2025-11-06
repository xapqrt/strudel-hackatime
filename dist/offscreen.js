(() => {
  // offscreen.ts
  console.log("[OFFSCREEN] Offscreen document loaded");
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SEND_HEARTBEAT") {
      console.log("[OFFSCREEN] Received heartbeat request");
      const { url, payload, apiKey } = message;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
      xhr.setRequestHeader("X-Machine-Name", "Strudel/1.0.0 strudel-wakatime/1.0.0");
      xhr.onload = function() {
        console.log("[OFFSCREEN] XHR Response:", xhr.status);
        sendResponse({
          success: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          responseText: xhr.responseText
        });
      };
      xhr.onerror = function() {
        console.error("[OFFSCREEN] XHR Error");
        sendResponse({
          success: false,
          error: "Network error"
        });
      };
      xhr.send(JSON.stringify(payload));
      return true;
    }
  });
})();
