// storage.ts
var Store = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
  }
  //loading config from chrome storage
  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        "apiKey",
        "enabled",
        "lastSync",
        "totalTime",
        "streak",
        "projectName",
        "beatCount",
        "lastBeatTime"
      ]);
      const cfg = {
        apiKey: result.apiKey || "",
        enabled: result.enabled !== false,
        lastSync: result.lastSync || 0,
        totalTime: result.totalTime || 0,
        streak: result.streak || 0,
        projectName: result.projectName || "strudel-live-coding",
        beatCount: result.beatCount || 0,
        lastBeatTime: result.lastBeatTime || 0
      };
      console.log("loaded config: ", cfg);
      return cfg;
    } catch (e) {
      console.error("storage load borked: ", e);
      return { enabled: true };
    }
  }
  //saveing config back
  async saveConfig(cfg) {
    try {
      await chrome.storage.sync.set(cfg);
      console.log("saved: ", cfg);
    } catch (e) {
      console.error("storage save failed: ", e);
    }
  }
  //getting heartbeatquqe\\
  async getQueue() {
    try {
      const result = await chrome.storage.local.get("queue");
      const q = result.queue || [];
      console.log(`queue has ${q.length} beats`);
      return q;
    } catch (e) {
      console.error("queue failed to load: ", e);
      return [];
    }
  }
  //saving quuqe back
  async saveQueue(queue) {
    try {
      await chrome.storage.local.set({ queue });
      console.log(` saved queue: ${queue.length}`);
    } catch (e) {
      console.error("queue save borked: ", e);
    }
  }
  //clearing old beats from queue
  async pruneQueue(maxAge = 864e5) {
    const q = await this.getQueue();
    const now = Date.now();
    const fresh = q.filter((qb) => now - qb.queued_at < maxAge);
    if (fresh.length < q.length) {
      console.log(` pruned ${q.length - fresh.length} old beats`);
      await this.saveQueue(fresh);
    }
  }
};

// background.ts
var store = new Store();
var API_BASE = "https://hackatime.hackclub.com/api/hackatime/v1";
var BATCH_INTERVAL = 6e4;
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{
          header: "User-Agent",
          operation: "set",
          value: "wakatime/v1.0.0 (chrome-extension) strudel-wakatime/0.1.0"
        }]
      },
      condition: {
        urlFilter: "*://hackatime.hackclub.com/*",
        resourceTypes: ["xmlhttprequest"]
        // Specifically target XHR for better reliability
      }
    }]
  }).then(() => {
    console.log("       User-Agent header rule set for Hackatime API");
    console.log("            URL Filter: *://hackatime.hackclub.com/*");
    console.log("                    User-Agent: wakatime/v1.0.0 (chrome-extension) strudel-wakatime/0.1.0");
    chrome.declarativeNetRequest.getDynamicRules().then((rules) => {
      console.log("will try to seach for dnr rules broski:", rules);
      if (rules.length === 0) {
        console.error("does not work this shi brochaho");
      } else {
        console.log("Rule count:", rules.length);
      }
    });
  }).catch((err) => {
    console.error("asnt able to set err:", err);
  });
});
async function setupOffscreenDocument() {
  if (!chrome.offscreen) {
    console.log("nah dis shit off");
    return;
  }
  try {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"]
    });
    if (existing.length > 0) {
      console.log(" might exists");
      return;
    }
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["DOM_SCRAPING"],
      justification: "xhr for api calls"
    });
    console.log("offscreen doc created");
  } catch (e) {
    console.error("couldnt create offscreen:", e);
  }
}
console.log("alr startin the background service worker");
setupOffscreenDocument();
chrome.declarativeNetRequest.getDynamicRules().then((rules) => {
  console.log(" dnr rule tryna select");
  if (rules.length === 0) {
    console.error("nah cant see no useragent");
  } else {
    console.log("Found", rules.length, "active rule(s):", rules);
  }
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "HEARTBEAT") {
    console.log("got beat from content:", msg.beat);
    handleBeat(msg.beat);
    sendResponse({ ok: true });
  } else if (msg.type === "GET_CONFIG") {
    store.loadConfig().then((cfg) => {
      sendResponse(cfg);
    });
    return true;
  } else if (msg.type === "SAVE_CONFIG") {
    store.saveConfig(msg.config).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg.type === "GET_QUEUE_SIZE") {
    store.getQueue().then((q) => {
      sendResponse({ size: q.length });
    });
    return true;
  } else if (msg.type === "RETRY_QUEUE") {
    console.log("manual retry triggered");
    processQueue().then(() => {
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg.type === "FETCH_STATS") {
    fetchStatsFromAPI().then((stats) => {
      sendResponse(stats);
    }).catch((e) => {
      console.error("stats fetch failed:", e);
      sendResponse({ error: true });
    });
    return true;
  }
});
async function handleBeat(beat) {
  try {
    const cfg = await store.loadConfig();
    console.log("checking config");
    console.log("   API Key:", cfg.apiKey ? `${cfg.apiKey.slice(0, 8)}...` : "NOT SET");
    console.log("   Enabled:", cfg.enabled !== false ? " YES" : "NO");
    if (!cfg.apiKey) {
      console.error("NO API KEY SET! Go to extension popup and add your Hackatime API key!");
      await queueBeat(beat);
      return;
    }
    if (cfg.enabled === false) {
      console.log("extension disabled, queueing beat");
      await queueBeat(beat);
      return;
    }
    console.log("tryna send beat now");
    const success = await sendBeat(beat, cfg.apiKey);
    if (success) {
      console.log(" beat sent, NOT queued");
      cfg.beatCount = (cfg.beatCount || 0) + 1;
      cfg.lastBeatTime = Date.now();
      await store.saveConfig(cfg);
    } else {
      console.log("send failed, queueing");
      await queueBeat(beat);
    }
  } catch (e) {
    console.error("Error handling beat:", e);
    await queueBeat(beat);
  }
}
async function queueBeat(beat) {
  try {
    const queue = await store.getQueue();
    const queued = {
      beat,
      retries: 0,
      queued_at: Date.now()
    };
    queue.push(queued);
    await store.saveQueue(queue);
    console.log(`queued beat, now ${queue.length} in queue`);
    updateBadge(queue.length);
  } catch (e) {
    console.error("failed to queue beat:", e);
  }
}
async function updateBadge(count) {
  try {
    if (count === void 0) {
      const q = await store.getQueue();
      count = q.length;
    }
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (e) {
    console.error("badge update failed:", e);
  }
}
async function processQueue() {
  try {
    const cfg = await store.loadConfig();
    if (!cfg.apiKey || !cfg.enabled) {
      console.log("no api key or disabled, skipping");
      return;
    }
    let queue = await store.getQueue();
    if (queue.length === 0) {
      return;
    }
    console.log(`processing ${queue.length} beats`);
    const remaining = [];
    for (const qb of queue) {
      const success = await sendBeat(qb.beat, cfg.apiKey);
      if (!success) {
        qb.retries++;
        if (qb.retries < 5) {
          remaining.push(qb);
          console.log(`beat failed, retry ${qb.retries}`);
        } else {
          console.log("beat failed too many times, dropping");
        }
      } else {
        console.log("beat sent successfully");
        await store.saveConfig({ lastSync: Date.now() });
      }
    }
    await store.saveQueue(remaining);
    updateBadge(remaining.length);
  } catch (e) {
    console.error("queue processing borked:", e);
  }
}
async function sendBeat(beat, apiKey) {
  try {
    const url = `${API_BASE}/users/current/heartbeats`;
    console.log("sending beat to:", url);
    console.log("payload:", JSON.stringify(beat, null, 2));
    let response;
    try {
      console.log("trying offscreen doc with xhr");
      response = await chrome.runtime.sendMessage({
        type: "SEND_HEARTBEAT",
        url,
        payload: beat,
        apiKey
      });
      console.log("got response from offscreen:", response);
    } catch (e) {
      console.log("fall back fetch:", e);
      response = null;
    }
    if (!response) {
      console.log("using regular fetch");
      const fetchResp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Machine-Name": "Strudel/1.0.0 strudel-wakatime/1.0.0"
        },
        body: JSON.stringify(beat)
      });
      response = {
        success: fetchResp.ok,
        status: fetchResp.status,
        responseText: await fetchResp.text()
      };
    }
    if (response.success && response.status >= 200 && response.status < 300) {
      console.log("api ok!");
      console.log("response:", response.responseText.substring(0, 200));
      const cfg = await store.loadConfig();
      cfg.beatCount = (cfg.beatCount || 0) + 1;
      cfg.lastBeatTime = Date.now();
      await store.saveConfig(cfg);
      return true;
    } else {
      console.error(`API error ${response.status}:`, response.responseText || response.error);
      if (response.status === 404) {
        const altUrl = "https://hackatime.hackclub.com/api/v1/my/heartbeats";
        console.log("Trying:", altUrl);
        const altResponse = await fetch(altUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Machine-Name": "Strudel/1.0.0 strudel-wakatime/1.0.0"
          },
          body: JSON.stringify(beat)
        });
        if (altResponse.ok) {
          console.log("the next one worked btw");
          return true;
        } else {
          const altTxt = await altResponse.text();
          console.error(`um change the url ig ${altResponse.status}:`, altTxt);
        }
      }
      return false;
    }
  } catch (e) {
    console.error("Fetch failed:", e);
    return false;
  }
}
setInterval(() => {
  console.log("periodic queue check");
  processQueue();
}, BATCH_INTERVAL);
setInterval(() => {
  console.log("pruning old beats");
  store.pruneQueue();
}, 864e5);
async function fetchStatsFromAPI() {
  try {
    const cfg = await store.loadConfig();
    if (!cfg.apiKey) {
      console.log("no api key, cant fetch stats");
      return { error: true, message: "no api key" };
    }
    const today = /* @__PURE__ */ new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    const url = `${API_BASE}/summaries?start=${startStr}&end=${endStr}`;
    console.log("fetching stats from:", url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "X-Machine-Name": "Strudel/1.0.0 strudel-wakatime/1.0.0"
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log("got stats from api:", data);
      let todaySeconds = 0;
      if (data.data && data.data.length > 0) {
        todaySeconds = data.data[0].grand_total?.total_seconds || 0;
      }
      await store.saveConfig({
        totalTime: todaySeconds,
        lastSync: Date.now()
      });
      return {
        todaySeconds,
        lastSync: Date.now()
      };
    } else {
      const txt = await response.text();
      console.error(`stats api error ${response.status}:`, txt);
      return { error: true, status: response.status };
    }
  } catch (e) {
    console.error("stats fetch failed:", e);
    return { error: true, message: String(e) };
  }
}
console.log("background worker ready");
