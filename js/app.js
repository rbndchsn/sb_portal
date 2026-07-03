/* ============================================================
   SB 54 Compliance Navigator — front-end engine
   Reads ./data/*.json (emitted from the workbook by the
   content factory). No framework, no build step, no runtime AI.
   ============================================================ */

const DATA = {};
const state = {
  q: "",
  companyFacing: new Set(),
  party: new Set(),
  article: new Set(),
  reqType: new Set(),
};

async function loadAll() {
  const files = ["meta", "requirements", "calendar", "pathways", "sources", "validation", "answers"];
  await Promise.all(files.map(async (f) => {
    try {
      const res = await fetch(`./data/${f}.json`);
      DATA[f] = await res.json();
    } catch (e) {
      DATA[f] = null; // answers.json may be absent in a minimal deploy
    }
  }));
}

/* ---------- helpers ---------- */
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const esc = (s) => (s == null ? "" : String(s));

function highlight(text, q) {
  const t = esc(text);
  if (!q) return t;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return t;
  return (
    t.slice(0, i) +
    "\u0001" + t.slice(i, i + q.length) + "\u0002" +
    t.slice(i + q.length)
  );
}
// render highlighted text safely into a node
function setHighlighted(node, text, q) {
  node.textContent = "";
  const marked = highlight(text, q);
  const parts = marked.split(/[\u0001\u0002]/);
  // parts alternate: [before, match, after, ...]
  let isMark = false;
  // reconstruct using markers
  let buf = "";
  for (let i = 0; i < marked.length; i++) {
    const ch = marked[i];
    if (ch === "\u0001") { if (buf) node.append(document.createTextNode(buf)); buf = ""; isMark = true; }
    else if (ch === "\u0002") { if (buf) { const m = el("mark", null, buf); node.append(m); } buf = ""; isMark = false; }
    else buf += ch;
  }
  if (buf) node.append(document.createTextNode(buf));
}

/* ---------- Tabs ---------- */
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.setAttribute("aria-selected", "false"));
      panels.forEach((p) => (p.dataset.active = "false"));
      t.setAttribute("aria-selected", "true");
      document.querySelector(`#panel-${t.dataset.tab}`).dataset.active = "true";
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    });
  });
}

/* ---------- Explorer: filter controls ---------- */
function cfClass(v) {
  if (v.startsWith("Yes")) return "calm";
  if (v.startsWith("Review")) return "";
  return "";
}
function buildChips(container, values, setRef, extraClass) {
  container.textContent = "";
  values.forEach(({ value, count }) => {
    const b = el("button", "chip" + (extraClass ? " " + extraClass : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.append(document.createTextNode(value));
    b.append(el("span", "c", String(count)));
    b.addEventListener("click", () => {
      if (setRef.has(value)) { setRef.delete(value); b.setAttribute("aria-pressed", "false"); }
      else { setRef.add(value); b.setAttribute("aria-pressed", "true"); }
      render();
    });
    container.append(b);
  });
}

function initControls() {
  const m = DATA.meta;
  buildChips(document.querySelector("#f-cf"), m.filters.company_facing, state.companyFacing, "calm");
  buildChips(document.querySelector("#f-party"), m.filters.party, state.party);
  buildChips(document.querySelector("#f-article"), m.filters.article, state.article);

  const search = document.querySelector("#f-search");
  search.addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });

  document.querySelector("#f-reset").addEventListener("click", () => {
    state.q = ""; search.value = "";
    state.companyFacing.clear(); state.party.clear(); state.article.clear();
    document.querySelectorAll(".controls .chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    render();
  });
}

/* ---------- Explorer: filtering + render ---------- */
function matches(r) {
  if (state.companyFacing.size && !state.companyFacing.has(r.company_facing)) return false;
  if (state.party.size && !state.party.has(r.party)) return false;
  if (state.article.size && !state.article.has(r.article)) return false;
  if (state.q) {
    const hay = (r.obligation + " " + r.section + " " + r.actor_verbatim + " " + r.op_action).toLowerCase();
    if (!hay.includes(state.q.toLowerCase())) return false;
  }
  return true;
}

function cfBadge(v) {
  if (v.startsWith("Yes")) return ["cf-yes", "Company-facing"];
  if (v.startsWith("Monitor")) return ["cf-mon", "Monitor only"];
  if (v.startsWith("Review")) return ["cf-rev", "Needs review"];
  return ["cf-mon", v];
}

function render() {
  const list = document.querySelector("#req-list");
  const rows = DATA.requirements.filter(matches);

  // count
  const cb = document.querySelector("#count");
  cb.textContent = "";
  cb.append(document.createTextNode(String(rows.length)));
  const total = DATA.requirements.length;
  cb.append(el("span", null, ` of ${total} obligations`));

  list.textContent = "";
  if (!rows.length) {
    const e = el("div", "empty",
      "No obligations match these filters. Clear a filter or broaden the search — every operative ‘shall’ in SB 54 is in here, so a null result usually means the combination is too narrow.");
    list.append(e);
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach((r) => {
    const card = el("div", "req");

    const top = el("div", "req-top");
    top.append(el("span", "sec", r.section + (r.list_path ? " " + r.list_path : "")));
    const [cfCls, cfTxt] = cfBadge(r.company_facing);
    top.append(el("span", "badge " + cfCls, cfTxt));
    if (r.party && r.party !== "Review") top.append(el("span", "badge party", r.party));
    if (r.basis === "Inferred (passive)") top.append(el("span", "badge basis-inf", "inferred"));
    if (r.basis === "Unresolved") top.append(el("span", "badge basis-unr", "unresolved actor"));
    card.append(top);

    const txt = el("div", "req-text");
    setHighlighted(txt, r.obligation, state.q);
    card.append(txt);

    const meta = el("div", "req-meta");
    let hasMeta = false;
    if (r.op_action) {
      const op = el("div", "op");
      op.append(el("b", null, "2026 operational action"));
      op.append(document.createTextNode(r.op_action));
      meta.append(op);
      hasMeta = true;
    }
    if (r.timing) { meta.append(el("div", "tim", "⏱ " + r.timing)); hasMeta = true; }
    if (hasMeta) card.append(meta);

    frag.append(card);
  });
  list.append(frag);
}

/* ---------- Calendar ---------- */
function renderCalendar() {
  const wrap = document.querySelector("#cal");
  wrap.textContent = "";
  DATA.calendar.deadlines.forEach((d) => {
    const row = el("div", "cal-row");
    const date = el("div", "cal-date");
    date.append(document.createTextNode(d.date));
    const past = String(d.status).toLowerCase().startsWith("past");
    date.append(el("span", "st " + (past ? "past" : "up"), past ? "Past" : "Upcoming"));
    row.append(date);

    const ct = el("div", "ctype");
    const pill = el("span", "pill t-" + d.type, d.type);
    ct.append(pill);
    row.append(ct);

    const body = el("div", "cal-body");
    body.append(el("div", "who", d.who));
    body.append(el("div", "act", d.action));
    if (d.basis) body.append(el("div", "auth", d.basis + (d.ref ? "  ·  source #" + d.ref : "")));
    row.append(body);

    wrap.append(row);
  });

  const watchWrap = document.querySelector("#watch");
  watchWrap.textContent = "";
  const h = el("h3", null, "Litigation & uncertainty watch — can shift obligations");
  watchWrap.append(h);
  DATA.calendar.watch.forEach((w) => watchWrap.append(el("p", null, w)));
}

/* ---------- Pathways ---------- */
function renderPathways() {
  const wrap = document.querySelector("#pathways");
  wrap.textContent = "";
  DATA.pathways.forEach((block) => {
    if (!block.heading) return;
    const b = el("div", "path-block");
    b.append(el("h3", null, block.heading));

    // targets table detection (block 4)
    const isTargets = /Performance targets/i.test(block.heading);
    if (isTargets) {
      const div = el("div", "targets");
      const table = el("table");
      block.rows.forEach((r, i) => {
        const tr = el("tr");
        r.forEach((cell) => {
          const c = el(i === 0 ? "th" : "td", null, cell);
          tr.append(c);
        });
        table.append(tr);
      });
      div.append(table);
      b.append(div);
    } else {
      const table = el("table", "kv");
      block.rows.forEach((r) => {
        const tr = el("tr");
        if (r.length === 1) {
          const td = el("td", null, r[0]); td.colSpan = 2; tr.append(td);
        } else {
          r.forEach((cell) => tr.append(el("td", null, cell)));
        }
        table.append(tr);
      });
      b.append(table);
    }
    wrap.append(b);
  });
}

/* ---------- Sources ---------- */
function renderSources() {
  const wrap = document.querySelector("#sources");
  wrap.textContent = "";
  DATA.sources.forEach((s) => {
    const row = el("div", "src-row");
    row.append(el("div", "src-n", s.n));
    const body = el("div");
    body.append(el("div", "src-org", s.org));
    if (s.title) body.append(el("div", "src-title", s.title));
    const meta = el("div", "src-meta");
    if (s.url) {
      const a = el("a", null, s.url);
      a.href = s.url; a.target = "_blank"; a.rel = "noopener";
      meta.append(a);
    }
    if (s.date) meta.append(document.createTextNode((s.url ? "  ·  " : "") + s.date));
    body.append(meta);
    row.append(body);
    wrap.append(row);
  });
}

/* ---------- Trust ---------- */
function scoreClass(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return "mod";
  if (n >= 8) return "hi";
  if (n >= 6) return "mod";
  return "low";
}
function renderTrust() {
  const lead = document.querySelector("#trust-lead");
  lead.textContent = "";
  const strong = el("b", null, DATA.validation.composite || "Composite reliability ≈ 6.5–7 / 10.");
  lead.append(strong);
  lead.append(document.createTextNode(
    " Every sheet below is rated for how far to lean on it, how it was built, and what a human still has to verify. This portal serves vetted content, but SB 54 turns on CalRecycle regulations and CAA program rules that keep moving and are under active litigation — verify before you act."));

  const wrap = document.querySelector("#trust");
  wrap.textContent = "";
  DATA.validation.sheets.forEach((s) => {
    const name = s["Sheet"] || s["sheet"] || "";
    const score = s["Trust /10"] || s["Trust/10"] || s["Trust"] || "";
    const card = el("details", "trust-card");
    const sum = el("summary");
    sum.append(el("span", "trust-name", name));
    if (score !== "") sum.append(el("span", "score " + scoreClass(score), score + " / 10"));
    card.append(sum);

    const body = el("div", "trust-body");
    const dl = el("dl");
    const fields = [
      ["How it was created", s["How it was created"]],
      ["Main risks", s["Main risks of error"]],
      ["Pros", s["Pros"]],
      ["Limits", s["Cons / limits"]],
      ["Human must", s["What a human must do"]],
    ];
    fields.forEach(([k, v]) => {
      if (!v) return;
      dl.append(el("dt", null, k));
      dl.append(el("dd", null, v));
    });
    body.append(dl);
    card.append(body);
    wrap.append(card);
  });
}

/* ---------- Approved Answers ---------- */
const qaState = { q: "", area: null };

function initAnswers() {
  const data = DATA.answers;
  const listWrap = document.querySelector("#qa-list");
  if (!data || !data.answers || !data.answers.length) {
    listWrap.textContent = "";
    listWrap.append(el("div", "empty",
      "Approved Answers are not loaded in this deployment. The Requirements Explorer above covers the full statute."));
    return;
  }
  if (data.includes_drafts) document.querySelector("#qa-draft-banner").classList.remove("hide");

  // area chips
  const areasWrap = document.querySelector("#qa-areas");
  areasWrap.textContent = "";
  data.areas.forEach(({ area, count }) => {
    const b = el("button", "chip");
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.append(document.createTextNode(area));
    b.append(el("span", "c", String(count)));
    b.addEventListener("click", () => {
      if (qaState.area === area) { qaState.area = null; b.setAttribute("aria-pressed", "false"); }
      else {
        qaState.area = area;
        areasWrap.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
      }
      renderAnswers();
    });
    areasWrap.append(b);
  });

  const search = document.querySelector("#qa-search");
  search.addEventListener("input", (e) => { qaState.q = e.target.value.trim(); renderAnswers(); });

  renderAnswers();
}

function qaMatches(a) {
  if (qaState.area && a.area !== qaState.area) return false;
  if (qaState.q) {
    const hay = (a.question + " " + a.alts.join(" ") + " " + a.answer + " " + a.tags.join(" ")).toLowerCase();
    if (!hay.includes(qaState.q.toLowerCase())) return false;
  }
  return true;
}

function renderAnswers() {
  const data = DATA.answers;
  const list = document.querySelector("#qa-list");
  const countEl = document.querySelector("#qa-count");
  const rows = data.answers.filter(qaMatches);

  countEl.textContent = "";
  countEl.append(document.createTextNode(`${rows.length} answer${rows.length === 1 ? "" : "s"}`));
  if (qaState.area) countEl.append(document.createTextNode(` in ${qaState.area}`));

  list.textContent = "";
  if (!rows.length) {
    list.append(el("div", "empty",
      "No approved answer matches yet. Try different words, clear the area filter, or check the Requirements Explorer for the underlying statute text."));
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach((a) => {
    const card = el("details", "qa-card");
    const sum = el("summary");
    const qwrap = el("div", "qa-q");
    setHighlighted(qwrap, a.question, qaState.q);
    sum.append(qwrap);
    sum.append(el("span", "qa-area", a.area));
    card.append(sum);

    const body = el("div", "qa-body");
    const ans = el("p", "qa-ans");
    setHighlighted(ans, a.answer, qaState.q);
    body.append(ans);

    const cite = el("div", "qa-cite");
    cite.append(el("span", "qa-cite-label", "Cites"));
    cite.append(document.createTextNode(a.citation));
    body.append(cite);

    if (a.status === "draft") {
      body.append(el("div", "qa-status", "Draft — pending review"));
    }
    card.append(body);
    frag.append(card);
  });
  list.append(frag);
}

/* ---------- Boot ---------- */
async function boot() {
  await loadAll();
  // fill masthead counts
  const c = DATA.meta.counts;
  document.querySelector("#stat-total").textContent = c.requirements;
  document.querySelector("#stat-cf").textContent = c.company_facing;
  document.querySelector("#stat-date").textContent = DATA.meta.content_dated;
  document.querySelectorAll("[data-n-total]").forEach(n => n.textContent = c.requirements);

  initTabs();
  initControls();
  render();
  renderCalendar();
  renderPathways();
  renderSources();
  renderTrust();
  initAnswers();
}

document.addEventListener("DOMContentLoaded", boot);
