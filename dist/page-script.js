(() => {
  // page-script.ts
  function getCodeMirrorState() {
    try {
      const contentEl = document.querySelector(".cm-content");
      if (!contentEl) {
        console.log("[HACKATIME] .cm-content not found");
        return null;
      }
      if (!contentEl.cmView) {
        console.log("[HACKATIME] cmView property not found on .cm-content");
        return null;
      }
      console.log("[HACKATIME] accessing cmView");
      const cmView = contentEl.cmView;
      const view = cmView.view || cmView.rootView?.view || cmView;
      if (view && view.state && view.state.selection) {
        const selection = view.state.selection.main;
        const currentLine = view.state.doc.lineAt(selection.head);
        return {
          cursorPosition: selection.head,
          lineNumber: currentLine.number,
          columnNumber: selection.head - currentLine.from + 1,
          documentLength: view.state.doc.length,
          totalLines: view.state.doc.lines,
          hasSelection: !selection.empty
        };
      }
    } catch (e) {
    }
    return null;
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "HACKATIME_GET_STATE") {
      const requestId = event.data.requestId;
      console.log("[HACKATIME PAGE SCRIPT] \u{1F4E8} Received state request ID:", requestId);
      const state = getCodeMirrorState();
      console.log("[HACKATIME PAGE SCRIPT] sending state:", state ? "GOT STATE" : "NO STATE");
      if (state) {
        console.log("[HACKATIME PAGE SCRIPT] State details:", {
          cursor: state.cursorPosition,
          line: state.lineNumber,
          col: state.columnNumber,
          totalLines: state.totalLines
        });
      }
      window.postMessage({
        type: "HACKATIME_STATE_RESPONSE",
        requestId,
        // Echo back the request ID for Promise resolution
        state
      }, "*");
    }
  });
  console.log("[HACKATIME \u{1F4DC}] Page script injected into page context");
  window.postMessage({ type: "HACKATIME_PAGE_SCRIPT_READY" }, "*");
  setTimeout(() => {
    const contentEl = document.querySelector(".cm-content");
    if (contentEl) {
      console.log("[HACKATIME] found .cm-content element");
      if (contentEl.cmView) {
        console.log("[HACKATIME] cmView property accessible");
      } else {
        console.log("[HACKATIME] .cm-content exists but cmView property not found");
      }
    } else {
      console.log("[HACKATIME \u23F3] .cm-content element not found yet");
    }
  }, 100);
})();
