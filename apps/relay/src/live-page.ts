/** Stage screen: every negotiation thread across accounts, updating live over SSE. */
export const LIVE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Negotiation Relay</title>
<style>
:root{--bg:#0f1115;--panel:#171a21;--line:#262b36;--text:#e7e9ee;--muted:#8a93a6;--store:#4f8cff;--customer:#22c55e;--supplier:#f59e0b;--bad:#ef4444}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}
header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--line)}
h1{font-size:16px;margin:0}.dot{width:8px;height:8px;border-radius:50%;background:var(--bad)}.dot.on{background:var(--customer)}
#accounts{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}.acc{padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--muted);font-size:12px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px;padding:16px}
.thread{background:var(--panel);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;max-height:78vh}
.th{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center}
.th b{font-size:13px}.status{margin-left:auto;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px;border-radius:99px;background:#232836}
.status.confirmed{background:#14532d}.status.rejected,.status.expired{background:#5b1d1d}
.msgs{overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.m{border-left:3px solid var(--muted);padding:6px 10px;background:#1d212a;border-radius:6px}
.m.store{border-color:var(--store)}.m.customer{border-color:var(--customer)}.m.supplier{border-color:var(--supplier)}
.m.err{border-color:var(--bad);color:#fca5a5}
.meta{font-size:11px;color:var(--muted);display:flex;gap:6px}.type{font-weight:600;color:var(--text);text-transform:uppercase}
.lines{margin:4px 0 0;padding:0;list-style:none;font-variant-numeric:tabular-nums}
.note{color:var(--muted);font-style:italic;margin-top:2px}.dec{font-size:11px;color:#93c5fd}
.empty{color:var(--muted);padding:40px;text-align:center;grid-column:1/-1}
@media (max-width:480px){main{grid-template-columns:1fr;padding:12px}}
</style></head><body>
<header><span class="dot" id="dot"></span><h1>Negotiation Relay</h1><div id="accounts"></div></header>
<main id="threads"><div class="empty">Waiting for the first RFQ…</div></main>
<script>
const qs = location.search;
let kinds = {}; const threads = new Map();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function lineHtml(l){ return "<li>" + esc(l.qty) + " × " + esc(l.title || l.sku) + (l.unit_price!=null ? " @ " + esc(l.unit_price) + " " + esc(l.currency) : "") + (l.deliver_by ? " · by " + esc(l.deliver_by) : "") + "</li>"; }
function msgHtml(m){
  if (m.kind === "rejected") return '<div class="m err"><div class="meta"><span class="type">blocked</span> ' + esc(m.from) + ' tried ' + esc(m.type) + '</div>' + esc(m.reason) + '</div>';
  return '<div class="m ' + esc(kinds[m.from.account] || "") + '"><div class="meta"><span class="type">' + esc(m.type) + '</span>' + esc(m.from.account) + '/' + esc(m.from.role) + ' → ' + esc(m.to.account) + ' <span style="margin-left:auto">#' + esc(m.seq) + (m.delivery ? " · " + esc(m.delivery) : "") + '</span></div>'
    + (m.lines ? '<ul class="lines">' + m.lines.map(lineHtml).join("") + '</ul>' : "")
    + (m.decision_id ? '<div class="dec">decision ' + esc(m.decision_id) + '</div>' : "")
    + (m.ref && m.ref.order_id ? '<div class="dec">Medusa order #' + esc(m.ref.order_display_id) + ' · ' + esc(m.ref.order_id) + '</div>' : "")
    + (m.note ? '<div class="note">“' + esc(m.note) + '”</div>' : "") + '</div>';
}
function render(){
  const el = document.getElementById("threads");
  if (!threads.size) return;
  el.innerHTML = [...threads.values()].sort((a,b)=> (b.updated_at||"").localeCompare(a.updated_at||"")).map(t =>
    '<section class="thread"><div class="th"><b>' + esc(t.id) + '</b><span style="color:var(--muted);font-size:12px">' + esc(t.requester) + ' ⇄ ' + esc(t.responder) + ' · round ' + esc(t.round) + '</span><span class="status ' + esc(t.status) + '">' + esc(t.status) + '</span></div><div class="msgs">' + t.messages.map(msgHtml).join("") + '</div></section>').join("");
  el.querySelectorAll(".msgs").forEach(m => m.scrollTop = m.scrollHeight);
}
async function load(){
  const snap = await (await fetch("/live/snapshot" + qs)).json();
  kinds = Object.fromEntries(snap.accounts.map(a => [a.id, a.kind]));
  document.getElementById("accounts").innerHTML = snap.accounts.map(a => '<span class="acc" style="border-color:var(--' + esc(a.kind) + ')">' + esc(a.name) + '</span>').join("");
  threads.clear(); for (const t of snap.threads.reverse()) threads.set(t.id, t); render();
}
function connect(){
  const es = new EventSource("/live/events" + qs);
  es.onopen = () => { document.getElementById("dot").classList.add("on"); load(); };
  es.onerror = () => document.getElementById("dot").classList.remove("on");
  es.addEventListener("message", ev => { const e = JSON.parse(ev.data); const t = threads.get(e.thread.id) || { messages: [] };
    if (!kinds[e.envelope.from.account]) load();
    threads.set(e.thread.id, { ...t, ...e.thread, messages: [...t.messages, e.envelope] }); render(); });
  es.addEventListener("rejected", ev => { const e = JSON.parse(ev.data); const t = threads.get(e.thread_id); if (t) { t.messages.push(e); render(); } });
  es.addEventListener("delivery", ev => { const e = JSON.parse(ev.data); const t = threads.get(e.thread_id); const m = t?.messages.find(x => x.msg_id === e.msg_id); if (m) { m.delivery = e.status; render(); } });
}
connect();
</script></body></html>`;
