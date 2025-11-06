(() => {
  // popup.ts
  document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
    loadQueueSize();
    document.getElementById("saveBtn")?.addEventListener("click", saveConfig);
    document.getElementById("retryBtn")?.addEventListener("click", retryQueue);
  });
  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
      if (response) {
        const apiKeyInput = document.getElementById("apiKey");
        const enabledCheckbox = document.getElementById("enabled");
        const projectNameInput = document.getElementById("projectName");
        if (apiKeyInput) {
          apiKeyInput.value = response.apiKey || "";
        }
        if (projectNameInput) {
          projectNameInput.value = response.projectName || "strudel-live-coding";
        }
        if (enabledCheckbox) {
          enabledCheckbox.checked = response.enabled !== false;
        }
        console.log("loaded config into popup");
      }
    } catch (e) {
      console.error("failed to load config:", e);
      showStatus("failed to load settings", "error");
    }
  }
  async function saveConfig() {
    const apiKeyInput = document.getElementById("apiKey");
    const enabledCheckbox = document.getElementById("enabled");
    const projectNameInput = document.getElementById("projectName");
    const config = {
      apiKey: apiKeyInput?.value || "",
      enabled: enabledCheckbox?.checked !== false,
      projectName: projectNameInput?.value || "strudel-live-coding"
    };
    try {
      await chrome.runtime.sendMessage({
        type: "SAVE_CONFIG",
        config
      });
      showStatus("settings saved", "success");
    } catch (e) {
      console.error("failed to save config:", e);
      showStatus("save failed", "error");
    }
  }
  async function loadStats() {
    try {
      const apiStats = await chrome.runtime.sendMessage({ type: "FETCH_STATS" });
      let totalTime = 0;
      let lastSync = 0;
      if (apiStats && !apiStats.error) {
        totalTime = apiStats.todaySeconds || 0;
        lastSync = apiStats.lastSync || 0;
        console.log("loaded fresh stats from api");
      } else {
        const response2 = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
        if (response2) {
          totalTime = response2.totalTime || 0;
          lastSync = response2.lastSync || 0;
          console.log("using cached stats");
        }
      }
      const todayEl = document.getElementById("todayTime");
      if (todayEl) {
        const hours = Math.floor(totalTime / 3600);
        const mins = Math.floor(totalTime % 3600 / 60);
        if (hours > 0) {
          todayEl.textContent = `${hours}h ${mins}m`;
        } else if (mins > 0) {
          todayEl.textContent = `${mins}m`;
        } else {
          todayEl.textContent = "0m";
        }
      }
      const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
      const beatCountEl = document.getElementById("beatCount");
      if (beatCountEl && response) {
        beatCountEl.textContent = (response.beatCount || 0).toString();
      }
      const lastBeatEl = document.getElementById("lastBeat");
      if (lastBeatEl && response && response.lastBeatTime) {
        const diff = Date.now() - response.lastBeatTime;
        const mins = Math.floor(diff / 6e4);
        if (mins < 1) {
          lastBeatEl.textContent = "just now";
        } else if (mins < 60) {
          lastBeatEl.textContent = `${mins}m ago`;
        } else {
          const hours = Math.floor(mins / 60);
          lastBeatEl.textContent = `${hours}h ago`;
        }
      }
      const lastSyncEl = document.getElementById("lastSync");
      if (lastSyncEl) {
        if (lastSync && lastSync > 0) {
          const diff = Date.now() - lastSync;
          const mins = Math.floor(diff / 6e4);
          if (mins < 1) {
            lastSyncEl.textContent = "just now";
          } else if (mins < 60) {
            lastSyncEl.textContent = `${mins}m ago`;
          } else {
            const hrs = Math.floor(mins / 60);
            lastSyncEl.textContent = `${hrs}h ago`;
          }
        } else {
          lastSyncEl.textContent = "never";
        }
      }
    } catch (e) {
      console.error("failed to load stats:", e);
    }
  }
  async function loadQueueSize() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_QUEUE_SIZE" });
      if (response && response.size !== void 0) {
        const queueItem = document.getElementById("queueItem");
        const queueSize = document.getElementById("queueSize");
        const retryBtn = document.getElementById("retryBtn");
        if (response.size > 0) {
          if (queueItem) {
            queueItem.style.display = "flex";
          }
          if (queueSize) {
            queueSize.textContent = `${response.size} beats`;
          }
          if (retryBtn) {
            retryBtn.style.display = "block";
          }
        } else {
          if (queueItem) {
            queueItem.style.display = "none";
          }
          if (retryBtn) {
            retryBtn.style.display = "none";
          }
        }
      }
    } catch (e) {
      console.error("failed to load queue size:", e);
    }
  }
  async function retryQueue() {
    try {
      showStatus("retrying...", "success");
      await chrome.runtime.sendMessage({ type: "RETRY_QUEUE" });
      showStatus("retry complete", "success");
      setTimeout(() => {
        loadQueueSize();
        loadStats();
      }, 1e3);
    } catch (e) {
      console.error("retry failed:", e);
      showStatus("retry failed", "error");
    }
  }
  function showStatus(msg, type) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = `status ${type}`;
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "status";
      }, 3e3);
    }
  }
})();
