const STYLE_ID = "reado-experience-runtime-style";
const PSEUDO_SELECTOR = ".concept-card, .item-card, [data-choice], [data-option], [data-action], [data-clickable]";
const HUD_ID = "reado-runtime-hud";

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

function clampText(value, maxLen = 240) {
  const text = normalizeText(value);
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .reado-runtime-clickable { cursor: pointer; }
    .reado-runtime-selected {
      outline: 1px solid rgba(34, 211, 238, 0.75);
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.18) inset;
    }
    .reado-runtime-hud {
      position: fixed;
      right: 14px;
      bottom: 14px;
      z-index: 88;
      display: grid;
      gap: 8px;
      max-width: min(94vw, 440px);
      pointer-events: auto;
      font-family: "Noto Sans SC", "PingFang SC", sans-serif;
    }
    .reado-runtime-hud-toggle {
      justify-self: end;
      border: 1px solid rgba(148, 163, 184, 0.42);
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.82);
      color: #dbeafe;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .reado-runtime-hud-panel {
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(2, 6, 23, 0.94);
      backdrop-filter: blur(8px);
      box-shadow: 0 18px 46px rgba(2, 8, 20, 0.5);
    }
    .reado-runtime-hud-head {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      padding: 8px;
      flex-wrap: wrap;
    }
    .reado-runtime-tab {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: #bfdbfe;
      padding: 5px 9px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 700;
    }
    .reado-runtime-tab.active {
      color: #ecfeff;
      border-color: rgba(34, 211, 238, 0.72);
      background: rgba(8, 145, 178, 0.34);
    }
    .reado-runtime-hud-body {
      padding: 10px;
      max-height: min(64vh, 420px);
      overflow: auto;
      color: #e2e8f0;
      display: grid;
      gap: 10px;
    }
    .reado-runtime-pane[hidden] { display: none; }
    .reado-runtime-skill {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      padding: 8px;
      background: rgba(15, 23, 42, 0.8);
      display: grid;
      gap: 6px;
    }
    .reado-runtime-skill h4 {
      margin: 0;
      font-size: 13px;
      color: #f0f9ff;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .reado-runtime-skill p {
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: #bfdbfe;
    }
    .reado-runtime-skill-kv {
      font-size: 11px;
      color: #93c5fd;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .reado-runtime-entry {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.8);
      overflow: hidden;
    }
    .reado-runtime-entry summary {
      cursor: pointer;
      padding: 8px 10px;
      font-size: 12px;
      color: #ecfeff;
      font-weight: 700;
      list-style: none;
    }
    .reado-runtime-entry summary::-webkit-details-marker { display: none; }
    .reado-runtime-entry-body {
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      padding: 8px 10px;
      display: grid;
      gap: 7px;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .reado-runtime-entry-links {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .reado-runtime-entry-links a {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 999px;
      padding: 3px 7px;
      font-size: 11px;
      text-decoration: none;
      color: #bae6fd;
      background: rgba(2, 6, 23, 0.6);
    }
    .reado-runtime-question {
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.8);
      padding: 8px;
      display: grid;
      gap: 7px;
    }
    .reado-runtime-question p {
      margin: 0;
      font-size: 12px;
      color: #f8fafc;
      font-weight: 700;
      line-height: 1.55;
    }
    .reado-runtime-option {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.45;
    }
    .reado-runtime-battle-submit {
      border: 1px solid rgba(34, 211, 238, 0.66);
      border-radius: 10px;
      background: rgba(8, 145, 178, 0.35);
      color: #ecfeff;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }
    .reado-runtime-battle-result {
      font-size: 12px;
      line-height: 1.6;
      color: #a5f3fc;
      min-height: 18px;
    }
    @media (max-width: 860px) {
      .reado-runtime-hud {
        right: 8px;
        left: 8px;
        bottom: 8px;
        max-width: none;
      }
      .reado-runtime-hud-toggle {
        justify-self: stretch;
      }
      .reado-runtime-hud-body {
        max-height: min(56vh, 380px);
      }
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
    }).catch(() => {}).finally(() => {
      sending = false;
      flush();
    });
  };

  return (action, label, value = null) => {
    queue.push({ action, label, value });
    flush();
  };
}

function sendDuration(bookId, moduleSlug, durationMs, reason) {
  const path = "/api/modules/" + encodeURIComponent(moduleSlug) + "/duration";
  const payload = JSON.stringify({ bookId, durationMs, reason });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(path, blob)) return;
    } catch {}
  }
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function normalizeModuleMeta(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  const skillPoints = asArray(row.skillPoints).map((item) => ({
    id: clampText(item?.id, 80),
    name: clampText(item?.name || item?.title, 120),
    description: clampText(item?.description || item?.summary, 320),
    difficulty: Number(item?.difficulty) || 1,
    power: Number(item?.power) || 0,
    xpReward: Number(item?.xpReward ?? item?.xp) || 0,
    gemReward: Number(item?.gemReward ?? item?.gems) || 0
  })).filter((item) => item.id || item.name).slice(0, 16);
  const thinkTankEntries = asArray(row.thinkTankEntries).map((entry) => ({
    id: clampText(entry?.id, 80),
    term: clampText(entry?.term, 120),
    title: clampText(entry?.title || entry?.term, 140),
    summary: clampText(entry?.summary, 380),
    insight: clampText(entry?.insight, 320),
    sourceCue: clampText(entry?.sourceCue, 220),
    relatedEntryRefs: asArray(entry?.relatedEntryRefs).map((rel) => ({
      id: clampText(rel?.id, 80),
      title: clampText(rel?.title || rel?.term, 140),
      books: asArray(rel?.books).map((book) => clampText(book, 120)).filter(Boolean)
    })).filter((rel) => rel.id).slice(0, 8)
  })).filter((item) => item.id || item.title).slice(0, 24);
  const knowledgeBattle = row.knowledgeBattle && typeof row.knowledgeBattle === "object" ? row.knowledgeBattle : {};
  const questions = asArray(knowledgeBattle.questions).map((q) => {
    const options = asArray(q?.options).map((opt) => clampText(opt, 220)).filter(Boolean).slice(0, 4);
    return {
      id: clampText(q?.id, 80),
      prompt: clampText(q?.prompt || q?.question, 240),
      options: options.length >= 2 ? options : [],
      answerIndex: Number.isFinite(Number(q?.answerIndex)) ? Math.max(0, Math.min(options.length - 1, Number(q.answerIndex))) : 0,
      explanation: clampText(q?.explanation, 280)
    };
  }).filter((q) => q.prompt && q.options.length >= 2).slice(0, 12);
  return {
    bookSummary: clampText(row.bookSummary, 420),
    skillPoints,
    thinkTankEntries,
    knowledgeBattle: {
      passScore: Math.max(1, Number(knowledgeBattle.passScore) || Math.ceil(Math.max(1, questions.length) * 0.6)),
      reward: {
        xp: Math.max(0, Number(knowledgeBattle.reward?.xp) || 0),
        gems: Math.max(0, Number(knowledgeBattle.reward?.gems) || 0)
      },
      questions
    }
  };
}

function setupKnowledgeHud({ bookId, moduleSlug, moduleMeta, track }) {
  const existing = document.getElementById(HUD_ID);
  if (existing) existing.remove();
  const meta = normalizeModuleMeta(moduleMeta);
  const hasData = meta.skillPoints.length || meta.thinkTankEntries.length || meta.knowledgeBattle.questions.length;
  if (!hasData) return;

  const host = document.createElement("section");
  host.id = HUD_ID;
  host.className = "reado-runtime-hud";
  host.innerHTML = `
    <button class="reado-runtime-hud-toggle" type="button">Skills / Think Tank / Battle</button>
    <div class="reado-runtime-hud-panel" hidden>
      <div class="reado-runtime-hud-head">
        <button class="reado-runtime-tab active" type="button" data-tab="skills">Skills</button>
        <button class="reado-runtime-tab" type="button" data-tab="lexicon">Think Tank</button>
        <button class="reado-runtime-tab" type="button" data-tab="battle">Battle</button>
      </div>
      <div class="reado-runtime-hud-body">
        <section class="reado-runtime-pane" data-pane="skills"></section>
        <section class="reado-runtime-pane" data-pane="lexicon" hidden></section>
        <section class="reado-runtime-pane" data-pane="battle" hidden></section>
      </div>
    </div>`;

  const panel = host.querySelector(".reado-runtime-hud-panel");
  const toggle = host.querySelector(".reado-runtime-hud-toggle");
  const skillsPane = host.querySelector('[data-pane="skills"]');
  const lexiconPane = host.querySelector('[data-pane="lexicon"]');
  const battlePane = host.querySelector('[data-pane="battle"]');
  const tabs = Array.from(host.querySelectorAll("[data-tab]"));

  if (skillsPane) {
    if (!meta.skillPoints.length) {
      skillsPane.innerHTML = `<p style="margin:0;font-size:12px;color:#94a3b8;">No skill points for this module yet.</p>`;
    } else {
      skillsPane.innerHTML = meta.skillPoints.map((skill) => `
        <article class="reado-runtime-skill">
          <h4>${skill.name || skill.id}<span>PWR ${Math.round(skill.power || 0)}</span></h4>
          <p>${skill.description || "Apply this concept in your own scenario reasoning."}</p>
          <div class="reado-runtime-skill-kv">
            <span>Difficulty ${Math.round(skill.difficulty || 1)}</span>
            <span>Reward +${Math.round(skill.xpReward || 0)} XP</span>
            <span>Reward +${Math.round(skill.gemReward || 0)} GEM</span>
          </div>
        </article>
      `).join("");
    }
  }

  if (lexiconPane) {
    if (!meta.thinkTankEntries.length) {
      lexiconPane.innerHTML = `<p style="margin:0;font-size:12px;color:#94a3b8;">No think tank entries for this module yet.</p>`;
    } else {
      lexiconPane.innerHTML = meta.thinkTankEntries.map((entry) => `
        <details class="reado-runtime-entry" data-entry-id="${entry.id}">
          <summary>${entry.title || entry.term || entry.id}</summary>
          <div class="reado-runtime-entry-body">
            <div>${entry.summary || "No summary available."}</div>
            ${entry.insight ? `<div>${entry.insight}</div>` : ""}
            ${entry.sourceCue ? `<div>Source cue: ${entry.sourceCue}</div>` : ""}
            <div class="reado-runtime-entry-links">
              ${entry.relatedEntryRefs.map((ref) => {
                const targetBook = ref.books && ref.books.length ? ref.books[0] : "";
                const href = targetBook ? `/books/${encodeURIComponent(targetBook)}` : "#";
                return `<a href="${href}" ${targetBook ? "" : 'onclick="return false;"'}>${ref.title || ref.id}</a>`;
              }).join("")}
            </div>
          </div>
        </details>
      `).join("");
      lexiconPane.querySelectorAll("details[data-entry-id]").forEach((detail) => {
        detail.addEventListener("toggle", () => {
          if (!detail.open) return;
          track("think_tank_open", detail.getAttribute("data-entry-id") || "");
        });
      });
    }
  }

  if (battlePane) {
    if (!meta.knowledgeBattle.questions.length) {
      battlePane.innerHTML = `<p style="margin:0;font-size:12px;color:#94a3b8;">No battle questions for this module yet.</p>`;
    } else {
      const questionsHtml = meta.knowledgeBattle.questions.map((q, idx) => `
        <article class="reado-runtime-question" data-q-id="${q.id || ("q" + idx)}">
          <p>${idx + 1}. ${q.prompt}</p>
          ${q.options.map((option, optIndex) => `
            <label class="reado-runtime-option">
              <input type="radio" name="battle-q-${idx}" value="${optIndex}" />
              <span>${option}</span>
            </label>
          `).join("")}
        </article>
      `).join("");
      battlePane.innerHTML = `
        ${questionsHtml}
        <button class="reado-runtime-battle-submit" type="button">Submit Battle</button>
        <div class="reado-runtime-battle-result"></div>`;
      const submitBtn = battlePane.querySelector(".reado-runtime-battle-submit");
      const resultBox = battlePane.querySelector(".reado-runtime-battle-result");
      if (submitBtn && resultBox) {
        submitBtn.addEventListener("click", async () => {
          const answers = meta.knowledgeBattle.questions.map((q, idx) => {
            const selected = battlePane.querySelector(`input[name="battle-q-${idx}"]:checked`);
            return selected ? Number(selected.value) : -1;
          });
          const score = answers.reduce((sum, answer, idx) => (
            answer === meta.knowledgeBattle.questions[idx].answerIndex ? sum + 1 : sum
          ), 0);
          const maxScore = meta.knowledgeBattle.questions.length;
          const passScore = Math.min(maxScore, Math.max(1, Number(meta.knowledgeBattle.passScore) || Math.ceil(maxScore * 0.6)));
          const won = score >= passScore;
          resultBox.textContent = `Score: ${score}/${maxScore} (pass line ${passScore})${won ? ", win." : ", not enough."} Syncing reward...`;
          track("knowledge_battle_submit", `${score}/${maxScore}`, { won, score, maxScore });
          try {
            const payload = await apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/battle-result", {
              bookId,
              score,
              maxScore,
              won
            });
            const battle = payload?.battle || {};
            if (battle?.shouldGrant && window.ReadoUser && typeof window.ReadoUser.grantRewards === "function") {
              window.ReadoUser.grantRewards({
                xp: Number(battle.reward?.xp) || 0,
                gems: Number(battle.reward?.gems) || 0,
                reason: "knowledge-battle:" + moduleSlug
              });
            }
            if (battle?.shouldGrant) {
              resultBox.textContent = `Victory: ${score}/${maxScore}, reward +${battle.reward?.xp || 0} XP / +${battle.reward?.gems || 0} GEM.`;
            } else if (battle?.won) {
              resultBox.textContent = `Victory: ${score}/${maxScore}. Reward for this module is already claimed. Keep improving your best score.`;
            } else {
              resultBox.textContent = `Not passed: ${score}/${maxScore}. Try again.`;
            }
          } catch {
            resultBox.textContent = `Score: ${score}/${maxScore}. Reward sync failed, please retry later.`;
          }
        });
      }
    }
  }

  toggle?.addEventListener("click", () => {
    const open = panel?.hidden;
    if (panel) panel.hidden = !open;
    track("knowledge_hud_toggle", open ? "open" : "close");
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.getAttribute("data-tab");
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      host.querySelectorAll(".reado-runtime-pane").forEach((pane) => {
        const isActive = pane.getAttribute("data-pane") === next;
        pane.hidden = !isActive;
      });
      track("knowledge_hud_tab", next || "unknown");
    });
  });

  document.body.append(host);
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
  const enteredAt = Date.now();
  let durationReported = false;

  const reportDuration = (reason) => {
    if (durationReported) return;
    durationReported = true;
    const stayMs = Math.max(0, Date.now() - enteredAt);
    sendDuration(bookId, moduleSlug, stayMs, reason || "leave");
  };

  apiRequest("POST", "/api/modules/" + encodeURIComponent(moduleSlug) + "/visit", { bookId }).catch(() => {});
  setupKnowledgeHud({
    bookId,
    moduleSlug,
    moduleMeta: config?.moduleMeta || {},
    track
  });

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

  window.addEventListener("pagehide", () => reportDuration("pagehide"), { once: true });
  window.addEventListener("beforeunload", () => reportDuration("beforeunload"), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportDuration("hidden");
    }
  }, { once: true });
}

window.ReadoExperienceRuntime = { init };
