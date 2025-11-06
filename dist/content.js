(() => {
  // tracker.ts
  var HeartbeatTracker = class {
    //30 seconds wakatime spec
    constructor() {
      this.lastBeatTime = 0;
      this.lastEntity = "";
      this.extractor = null;
      this.THROTTLE_MS = 3e4;
      const VERBOSE2 = false;
      function log2(...args) {
        if (VERBOSE2) console.log(...args);
      }
      log2("tracker init");
    }
    //set the metadata extractor
    setExtractor(ext) {
      this.extractor = ext;
      if (globalThis.__TRACKER_VERBOSE) console.log("extractor attached");
    }
    //check if we should send a heartbeat 
    shouldSendBeat(entity) {
      const now = Date.now();
      const timeSinceLast = now - this.lastBeatTime;
      if (timeSinceLast >= this.THROTTLE_MS) {
        return true;
      }
      if (entity !== this.lastEntity) {
        return true;
      }
      return false;
    }
    //create a heartbeat object
    async createBeat(isWrite) {
      if (!this.extractor) {
        console.error("no extractor attached yet");
        return null;
      }
      try {
        const meta = this.extractor.getCursorMeta();
        const entity = this.extractor.getEntity();
        const project = await this.extractor.getProject();
        if (!this.shouldSendBeat(entity)) {
          if (globalThis.__TRACKER_VERBOSE) console.log("throttled, skipping beat");
          return null;
        }
        const beat = {
          entity,
          type: "file",
          time: Date.now() / 1e3,
          language: "JavaScript",
          is_write: isWrite,
          project,
          // These fields work together to identify the editor
          editor: "Strudel",
          plugin: "Strudel/1.0.0 strudel-wakatime/1.0.0",
          //optional metadata
          lines: meta.lines,
          lineno: meta.lineno,
          cursorpos: meta.cursorpos,
          category: "coding"
        };
        console.log("metadata being sent:", {
          lines: meta.lines,
          lineno: meta.lineno,
          cursorpos: meta.cursorpos
        });
        console.log("beat created with project:", project);
        this.lastBeatTime = Date.now();
        this.lastEntity = entity;
        if (globalThis.__TRACKER_VERBOSE) console.log("created beat:", beat);
        return beat;
      } catch (e) {
        console.error("failed to create beat:", e);
        return null;
      }
    }
    //record typing 
    async recordEdit() {
      return await this.createBeat(true);
    }
    //reading one, it shows on hackatime i saw
    async recordRead() {
      return await this.createBeat(false);
    }
    //manual reset when i debug
    reset() {
      this.lastBeatTime = 0;
      this.lastEntity = "";
      if (globalThis.__TRACKER_VERBOSE) console.log("tracker reset");
    }
  };

  // metadata.ts
  var MetadataExtractor = class {
    constructor(view) {
      this.cm_view = null;
      this.pageScriptState = null;
      this.cm_view = view;
    }
    //pulls all the cursor stuff hackatime wants
    getCursorMeta() {
      if (this.pageScriptState) {
        console.log("[METADATA] using page script state:", {
          lines: this.pageScriptState.totalLines,
          lineno: this.pageScriptState.lineNumber,
          cursorpos: this.pageScriptState.columnNumber
        });
        return {
          lines: this.pageScriptState.totalLines,
          lineno: this.pageScriptState.lineNumber,
          cursorpos: this.pageScriptState.columnNumber
        };
      }
      console.log("[METADATA] no page script state, trying cm_view");
      try {
        const state = this.cm_view.state;
        if (!state) {
          if (globalThis.__METADATA_VERBOSE) console.log("no state found, using defaults");
          return { lines: 1, lineno: 1, cursorpos: 1 };
        }
        const sel = state.selection.main;
        const pos = sel.head;
        if (globalThis.__METADATA_VERBOSE) console.log("cursor at:", pos);
        const line = state.doc.lineAt(pos);
        const lineNo = line.number;
        const col = pos - line.from + 1;
        const totalLines = state.doc.lines;
        if (globalThis.__METADATA_VERBOSE) console.log(`line ${lineNo}, col ${col}, total ${totalLines}`);
        return {
          lines: totalLines,
          lineno: lineNo,
          cursorpos: col
        };
      } catch (e) {
        if (globalThis.__METADATA_VERBOSE) console.log("error getting cursor meta, using defaults:", e);
        return { lines: 1, lineno: 1, cursorpos: 1 };
      }
    }
    getEntity() {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        return `strudel-${hash.slice(1, 10)}.js`;
      }
      return "strudel-pattern-main.js";
    }
    //idk if i need this but might be useful later
    async getProject() {
      try {
        const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
        if (response && response.projectName) {
          return response.projectName;
        }
      } catch (e) {
        if (globalThis.__METADATA_VERBOSE) console.log("failed to get project name from config:", e);
      }
      const url = window.location.href;
      if (url.includes("strudel.cc")) {
        return "strudel-live-coding";
      }
      return "strudel";
    }
  };

  // content.ts
  var VERBOSE = false;
  function log(...args) {
    if (VERBOSE) console.log(...args);
  }
  function clog(...args) {
    console.log(`[HACKATIME]`, ...args);
  }
  var tracker = null;
  var extractor = null;
  var editorView = null;
  var lastActivity = 0;
  var isIdle = false;
  var IDLE_TIMEOUT = 3e5;
  function findEditor() {
    log("findEditor called, checking methods...");
    if (window.strudelEditor) {
      log("found strudel editor on window");
      return window.strudelEditor;
    }
    if (window.editor) {
      log("found editor on window");
      return window.editor;
    }
    if (window.view) {
      log("found view on window");
      return window.view;
    }
    if (window.codemirrorSettings) {
      log("found codemirrorSettings");
      const settings = window.codemirrorSettings;
      if (settings.view) {
        log("found view in codemirrorSettings");
        return settings.view;
      }
    }
    const windowKeys = Object.keys(window);
    for (const key of windowKeys) {
      const prop = window[key];
      if (prop && prop.state && prop.state.doc && prop.dispatch) {
        log("found Edview like object on window:", key);
        return prop;
      }
    }
    const cmElements = document.querySelectorAll(".cm-editor");
    if (cmElements.length > 0) {
      log(`found ${cmElements.length} cm editors in dom`);
      const el = cmElements[0];
      log("using cm element, metadata will use defaults");
      return { dom: el };
    }
    log("editor not found yet, will retry");
    return null;
  }
  var pageScriptState = null;
  var pageScriptReady = false;
  var pendingRequests = /* @__PURE__ */ new Map();
  var requestId = 0;
  function injectPageScript() {
    clog("\u{1F489}", "Injecting page script...");
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("dist/page-script.js");
    clog("\u{1F489}", "Script URL:", script.src);
    script.onload = () => {
      clog("Page script loaded successfully");
    };
    script.onerror = (e) => {
      clog("Failed to load page script:", e);
    };
    (document.head || document.documentElement).appendChild(script);
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "HACKATIME_PAGE_SCRIPT_READY") {
      pageScriptReady = true;
      clog("page script ready signal received");
    }
    if (event.data.type === "HACKATIME_STATE_RESPONSE") {
      const { requestId: respId, state } = event.data;
      pageScriptState = state;
      const resolver = pendingRequests.get(respId);
      if (resolver) {
        resolver(state);
        pendingRequests.delete(respId);
      }
      if (state) {
        clog("\u{1F4E8}", "Got state:", `line ${state.lineNumber}, col ${state.columnNumber}`);
      } else {
        clog("\u26A0\uFE0F", "Page script returned null state");
      }
    }
  });
  function requestPageScriptState() {
    return new Promise((resolve) => {
      if (!pageScriptReady) {
        clog("Page script not ready yet, cannot request state");
        resolve(null);
        return;
      }
      const currentId = requestId++;
      pendingRequests.set(currentId, resolve);
      setTimeout(() => {
        if (pendingRequests.has(currentId)) {
          pendingRequests.delete(currentId);
          clog("Page script state request timed out");
          resolve(null);
        }
      }, 200);
      log(" Requesting state from page script with ID:", currentId);
      window.postMessage({
        type: "HACKATIME_GET_STATE",
        requestId: currentId
      }, "*");
    });
  }
  function initTracker(view) {
    clog("Found editor! Initializing tracker...");
    editorView = view;
    tracker = new HeartbeatTracker();
    extractor = new MetadataExtractor(view);
    tracker.setExtractor(extractor);
    attachEditorListeners();
    injectPageScript();
    clog("tracker initialized");
    clog("\u{1F389}", "Extension is now tracking your edits on Strudel");
  }
  function attachEditorListeners() {
    if (!editorView) return;
    try {
      let domElement = null;
      if (editorView.dom) {
        domElement = editorView.dom;
      } else if (editorView instanceof HTMLElement) {
        domElement = editorView;
      } else {
        domElement = document.querySelector(".cm-content");
      }
      if (!domElement) {
        clog("couldnt find DOM element to attach listeners");
        return;
      }
      clog("attaching listeners to:", domElement.className);
      domElement.addEventListener("input", () => {
        handleEdit();
      });
      domElement.addEventListener("click", () => {
        handleRead();
      });
      domElement.addEventListener("keydown", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          handleRead();
        } else if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          handleEdit();
        }
      });
      clog("editor listeners attached");
    } catch (e) {
      console.error("failed to attach listeners:", e);
    }
  }
  async function handleEdit() {
    const now = Date.now();
    lastActivity = now;
    if (isIdle) {
      isIdle = false;
      log("user active again");
    }
    if (!tracker) return;
    const state = await requestPageScriptState();
    if (extractor && state) {
      extractor.pageScriptState = state;
      clog("state received before beat");
    } else {
      clog("no state received, will use defaults");
    }
    const beat = await tracker.recordEdit();
    if (beat) {
      sendBeat(beat);
    }
  }
  async function handleRead() {
    const now = Date.now();
    if (now - lastActivity < 5e3) {
      return;
    }
    lastActivity = now;
    if (isIdle) {
      isIdle = false;
      log("user active again");
    }
    if (!tracker) return;
    const beat = await tracker.recordRead();
    if (beat) {
      sendBeat(beat);
    }
  }
  function checkIdleState() {
    const now = Date.now();
    const timeSinceActivity = now - lastActivity;
    if (!isIdle && timeSinceActivity >= IDLE_TIMEOUT) {
      isIdle = true;
      log("user idle, pausing heartbeats");
    }
  }
  setInterval(checkIdleState, 6e4);
  function sendBeat(beat) {
    if (isIdle) {
      log("skipping beat, user idle");
      return;
    }
    try {
      chrome.runtime.sendMessage({
        type: "HEARTBEAT",
        beat
      }, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          if (error.includes("Extension context invalidated")) {
            clog("\u26A0\uFE0F", "Extension was reloaded. Please refresh this page to reconnect.");
            return;
          }
          console.error("send beat failed:", chrome.runtime.lastError);
        } else {
          log("beat sent to background");
        }
      });
    } catch (e) {
      const errorMsg = String(e);
      if (errorMsg.includes("Extension context invalidated")) {
        clog("Extension was reloaded. Please refresh this page.");
      } else {
        console.error("failed to send beat:", e);
      }
    }
  }
  var pollAttempts = 0;
  var maxAttempts = 20;
  function pollForEditor() {
    const view = findEditor();
    if (view) {
      clog("editor found on attempt", pollAttempts + 1);
      initTracker(view);
      return;
    }
    pollAttempts++;
    if (pollAttempts >= maxAttempts) {
      clog(`couldnt find editor after ${pollAttempts} attempts`);
      clog("\u{1F50D}", "Switching to MutationObserver to watch for editor...");
      startMutationObserver();
      return;
    }
    const delay = Math.min(100 * Math.pow(1.5, pollAttempts), 5e3);
    if (pollAttempts === 1 || pollAttempts % 5 === 0) {
      clog(`looking for editor (attempt ${pollAttempts})`);
    }
    setTimeout(pollForEditor, delay);
  }
  var observer = null;
  function startMutationObserver() {
    log("starting mutation observer for editor");
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const view = findEditor();
          if (view) {
            log("mutation observer found editor");
            observer?.disconnect();
            initTracker(view);
            return;
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    log("watching for editor to appear");
  }
  function trackActivity() {
    lastActivity = Date.now();
    if (isIdle) {
      isIdle = false;
      log("activity detected, user back");
    }
  }
  document.addEventListener("mousemove", trackActivity, { passive: true });
  document.addEventListener("keypress", trackActivity, { passive: true });
  document.addEventListener("scroll", trackActivity, { passive: true });
  clog("\u{1F680}", "Strudel Hackatime extension loaded");
  clog("\u{1F4CD}", "URL:", window.location.href);
  clog("\u{1F50D}", "Looking for CodeMirror editor...");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      log("dom loaded, looking for editor");
      pollForEditor();
    });
  } else {
    log("dom already loaded");
    pollForEditor();
  }
})();
