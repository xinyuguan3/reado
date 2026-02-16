const STYLE_ID = "reado-experience-runtime-style";
const PSEUDO_SELECTOR = ".concept-card, .item-card, [data-choice], [data-option], [data-action], [data-clickable]";

function apiRequest(method, path, payload) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  }).then(async (response) => {
    let data = {};
    try {
      data = await response.json();
    } catch {}
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || ("Request failed with " + response.status));
    }
    return data;
  });
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .reado-runtime-clickable {
      cursor: pointer;
    }
    .reado-runtime-selected {
      outline: 1px solid rgba(34, 211, 238, 0.75);
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.18) inset;
    }
  `;
  document.head.append(style);
}

function isNativeInteractive(node) {
  const tag = (node.tagName || "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return true;
  const role = (node.getAttribute("role") || "").toLowerCase();
  return role === "button" || role === "link";
}

function getNodeLabel(node) {
  const aria = node.getAttribute("aria-label");
  if (aria) return normalizeText(aria).slice(0, 120);
  const text = normalizeText(node.textContent || "");
  if (text) return text.slice(0, 120);
  const title = node.getAttribute("title");
  if (title) return normalizeText(title).slice(0, 120);
  return (node.tagName || "unknown").toLowerCase();
}

function pickInteractiveNode(target) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest(".reado-shell-wrap")) return null;
  return target.closest("button, a, [role='button'], input, select, textarea, .concept-card, .item-card, .module-card, [data-choice], [data-option], [data-action], [data-clickable]");
}

function markPseudoInteractive(root = document) {
  const nodes = root.querySelectorAll(PSEUDO_SELECTOR);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (isNativeInteractive(node)) continue;
    node.classList.add("reado-runtime-clickable");
    if (!node.hasAttribute("role")) node.setAttribute("role", "button");
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "0");
    if (node.__readoRuntimeKeydownBound) continue;
    node.__readoRuntimeKeydownBound = true;
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        node.click();
      }
    });
  }
}

function applySelectionFeedback(node) {
  const target = node.closest(".concept-card, .item-card, [data-choice], [data-option]");
  if (!(target instanceof HTMLElement)) return;
  const parent = target.parentElement;
  if (!parent) {
    target.classList.toggle("reado-runtime-selected");
    return;
  }
  const siblings = Array.from(parent.children).filter((item) => item instanceof HTMLElement);
  const sameGroup = siblings.filter((item) =>
    item.matches(".concept-card, .item-card, [data-choice], [data-option]")
  );
  if (sameGroup.length <= 1) {
    target.classList.toggle("reado-runtime-selected");
    return;
  }
  for (const item of sameGroup) {
    item.classList.toggle("reado-runtime-selected", item === target);
  }
}

function createTracker(bookId, moduleSlug) {
  const queue = [];
  let sending = false;

  const flush = () => {
    if (sending || queue.length === 0) return;
    sending = true;
    const next = queue.shift();
    apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/interactions", {
      bookId,
      action: next.action,
      label: next.label,
      value: next.value
    })
      .catch(() => {})
      .finally(() => {
        sending = false;
        flush();
      });
  };

  return (action, label, value = null) => {
    queue.push({ action, label, value });
    flush();
  };
}

function init(config) {
  const bookId = typeof config?.bookId === "string" ? config.bookId.trim() : "";
  const moduleSlug = typeof config?.moduleSlug === "string" ? config.moduleSlug.trim() : "";
  if (!bookId || !moduleSlug) return;
  if (window.__readoExperienceRuntimeInitFor === moduleSlug) return;
  window.__readoExperienceRuntimeInitFor = moduleSlug;

  ensureStyle();
  markPseudoInteractive();
  const track = createTracker(bookId, moduleSlug);

  apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/visit", { bookId }).catch(() => {});

  document.addEventListener("click", (event) => {
    const interactive = pickInteractiveNode(event.target);
    if (!interactive) return;
    track("click", getNodeLabel(interactive));
    applySelectionFeedback(interactive);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, select, textarea")) return;
    if (target.closest(".reado-shell-wrap")) return;
    const value = "value" in target ? target.value : null;
    track("change", getNodeLabel(target), value);
  });
}

window.ReadoExperienceRuntime = { init };
