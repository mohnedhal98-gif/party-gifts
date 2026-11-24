/* Gemini X Toys – back office (venue staff) and admin portal */
(async function () {
  const $ = id => document.getElementById(id);
  const MODE = document.body.dataset.mode || "staff"; // "staff" or "admin"
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let C, ALL;
  try { ({ config: C, products: ALL } = await GX.load()); }
  catch (e) { $("app").innerHTML = '<div class="o-empty">Could not load. Please refresh.</div>'; return; }
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));
  const venueOf = id => C.venues.find(v => v.id === id) || { id, name: id, retail: id };
  const cur = C.currency || "QAR";
  const money = n => cur + " " + (Math.round(n * 100) / 100).toLocaleString("en-GB");
  const LG = C.logoLight || C.logo;
  if (LG) $("ologo").innerHTML = `<img src="${esc(LG)}" alt="Gemini X">`;

  const STATUS = { new: ["🆕", "New"], preparing: ["🎀", "Preparing"], ready: ["✅", "Ready"], collected: ["🎉", "Collected"], cancelled: ["✖️", "Cancelled"] };
  const PAY = { pending: "Not paid", link_sent: "Link sent", paid: "Paid" };
  const NEXT = { new: ["preparing", "🎀 Start preparing"], preparing: ["ready", "✅ Mark ready"], ready: ["collected", "🎉 Collected"] };

  let pin = sessionStorage.getItem("gx-pin-" + MODE) || "", role = "", orders = [], filter = "open", vf = "", q = "", seen = new Set(), first = true, showBc = {};

  async function api(body) {
    if (!C.ordersApi) throw new Error("The orders connection is not set up yet (ordersApi in data/config.json).");
    const r = await fetch(C.ordersApi, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Error");
    return j;
  }

  /* ---------- login ---------- */
  function showLogin(msg) {
    $("app").innerHTML = `<div class="o-login">
      <div class="o-lk">🔒</div>
      <h1>${MODE === "admin" ? "Admin portal" : "Shop back office"}</h1>
      <p>${MODE === "admin" ? "Enter the admin password to see orders from all venues." : "Enter your venue PIN to see your gift orders."}</p>
      <input id="pinIn" class="in-f" type="password" ${MODE === "admin" ? "" : 'inputmode="numeric"'} autocomplete="current-password" placeholder="${MODE === "admin" ? "Password" : "PIN"}">
      <div class="err" id="perr">${msg ? "⚠️ " + esc(msg) : ""}</div>
      <button class="bigbtn" id="pinGo">Open</button></div>`;
    $("pinIn").focus();
    const go = async () => {
      const p = $("pinIn").value.trim(); if (!p) return;
      $("pinGo").disabled = true; $("pinGo").textContent = "Checking…";
      try {
        const j = await api({ action: "login", pin: p });
        if (MODE === "admin" && j.role !== "admin") throw new Error("Wrong password");
        pin = p; role = j.role; sessionStorage.setItem("gx-pin-" + MODE, p); start();
      } catch (e) { showLogin(e.message); }
    };
    $("pinGo").onclick = go; $("pinIn").onkeydown = e => { if (e.key === "Enter") go(); };
  }

  /* ---------- data ---------- */
  async function load(quiet) {
    try {
      const j = await api({ action: "list", pin });
      role = j.role;
      const fresh = j.orders.filter(o => !seen.has(o.ref));
      j.orders.forEach(o => seen.add(o.ref));
      orders = j.orders;
      if (!first && fresh.length) { beep(); flash(fresh.length); }
      first = false;
      $("upd").textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      draw();
    } catch (e) {
      if (/PIN/i.test(e.message)) { sessionStorage.removeItem("gx-pin-" + MODE); return showLogin(e.message); }
      if (!quiet) toast("⚠️ " + e.message);
    }
  }
  async function update(ref, patch) {
    const o = orders.find(x => x.ref === ref); if (o) Object.assign(o, patch); draw();
    try { await api(Object.assign({ action: "update", pin, ref }, patch)); toast("Saved ✓"); }
    catch (e) { toast("⚠️ " + e.message); load(true); }
  }

  /* ---------- WhatsApp messages ---------- */
  const niceDate = d => { if (!d) return ""; const x = new Date(d + "T00:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
  function itemsText(o) { return o.items.map(([id, n]) => `• ${n} × ${byId[id] ? byId[id].name : id}`).join("\n"); }
  function msg(kind, o, link) {
    const v = venueOf(o.venue), shop = (v.retail || v.name) + " by Gemini X", ar = o.lang === "ar";
    const pay = o.payment === "link" ? (ar ? "سيصلك رابط الدفع على الواتساب" : "You'll receive a secure payment link on WhatsApp") : (ar ? "الدفع نقداً عند الاستلام من متجر الألعاب" : "Cash on arrival at the toy shop");
    if (ar) return {
      confirm: `مرحباً ${o.customer} 👋\nمعك ${shop} 🎁\nوصلنا طلب الهدية ${o.ref} لعيد ميلاد ${o.child}${o.partyDate ? " يوم " + o.partyDate : ""}.\n\n${itemsText(o)}\nالمجموع: ${money(o.total)}\nالتغليف مجاني ✨\n\nالدفع: ${pay}\nشكراً لك!`,
      link: `مرحباً ${o.customer}، هذا رابط الدفع الآمن لطلبك ${o.ref} (${money(o.total)}):\n${link}\nبعد الدفع نجهز الهدية ونغلفها 🎀`,
      ask: `مرحباً ${o.customer}، بخصوص طلب الهدية ${o.ref} (${money(o.total)}): هل تفضل الدفع نقداً عند وصولك إلى المتجر، أم نرسل لك رابط دفع؟`,
      ready: `مرحباً ${o.customer} 🎉 طلبك ${o.ref} مغلف وجاهز في متجر الألعاب في ${v.retail ? v.retail.replace(/ Retail$/, "") : v.name}. نراك في الحفلة!`
    }[kind];
    return {
      confirm: `Hi ${o.customer} 👋\nThis is ${shop} 🎁\nWe received your gift order ${o.ref} for ${o.child}'s birthday${o.partyDate ? " on " + niceDate(o.partyDate) : ""}.\n\n${itemsText(o)}\nTotal: ${money(o.total)}\nFree gift wrap ✨\n\nPayment: ${pay}\nThank you!`,
      link: `Hi ${o.customer}, here is your secure payment link for gift order ${o.ref} (${money(o.total)}):\n${link}\nOnce it's paid we'll prepare and wrap your gift 🎀`,
      ask: `Hi ${o.customer}, about your gift order ${o.ref} (${money(o.total)}): would you like to pay cash when you arrive at the toy shop, or shall we send you a payment link?`,
      ready: `Hi ${o.customer} 🎉 Your gift order ${o.ref} is wrapped and ready at our toy shop in ${v.name}. See you at the party!`
    }[kind];
  }
  const wa = (o, text) => window.open("https://wa.me/" + o.whatsapp + "?text=" + encodeURIComponent(text), "_blank");

  /* ---------- drawing ---------- */
  const fmtPhone = d => (d = String(d || ""), d.startsWith("974") && d.length === 11 ? "+974 " + d.slice(3, 7) + " " + d.slice(7) : "+" + d);
  const isOpen = o => o.status !== "collected" && o.status !== "cancelled";
  const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

  function start() {
    const mine = role === "admin" ? null : venueOf(role);
    $("app").innerHTML = `
      <div class="o-bar">
        <div class="o-title"><b>${role === "admin" ? "Admin portal" : esc(mine.retail || mine.name)}</b><span>${role === "admin" ? "All venues · Gemini X Toys" : "Back office · by Gemini X"}</span></div>
        <div class="o-tools"><span class="o-upd" id="upd"></span><button class="tbtn" id="refresh">🔄 Refresh</button>${role === "admin" ? '<button class="tbtn" id="csv">⬇️ Export</button>' : ""}<button class="tbtn" id="logout">Log out</button></div>
      </div>
      ${role === "admin" ? '<div class="o-stats" id="stats"></div>' : ""}
      <div class="o-filters">
        <div class="o-tabs" id="tabs"></div>
        ${role === "admin" ? `<select class="in-f o-vsel" id="vsel"><option value="">All venues</option>${C.venues.map(v => `<option value="${v.id}">${esc(v.retail || v.name)}</option>`).join("")}</select>` : ""}
        <input class="in-f o-search" id="search" placeholder="Search name, phone, order no.">
      </div>
      <div id="list" class="o-list"><div class="o-empty">Loading orders…</div></div>`;
    $("refresh").onclick = () => load();
    $("logout").onclick = () => { sessionStorage.removeItem("gx-pin-" + MODE); pin = ""; showLogin(); };
    if ($("csv")) $("csv").onclick = exportCsv;
    if ($("vsel")) $("vsel").onchange = () => { vf = $("vsel").value; draw(); };
    $("search").oninput = () => { q = $("search").value.toLowerCase().trim(); draw(); };
    $("tabs").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { filter = b.dataset.f; draw(); } };
    load();
    clearInterval(window.__gxPoll); window.__gxPoll = setInterval(() => load(true), 30000);
  }

  function draw() {
    if (!$("list")) return;
    let base = orders.filter(o => !vf || o.venue === vf);
    const cnt = f => base.filter(o => f === "all" ? true : f === "open" ? isOpen(o) : f === "unpaid" ? (isOpen(o) && o.paymentStatus !== "paid") : o.status === f).length;
    const tabs = [["open", "Open"], ["new", "🆕 New"], ["preparing", "🎀 Preparing"], ["ready", "✅ Ready"], ["unpaid", "💳 Not paid"], ["collected", "🎉 Collected"], ["cancelled", "Cancelled"], ["all", "All"]];
    $("tabs").innerHTML = tabs.map(([f, l]) => `<button class="pill ${filter === f ? "on" : ""}" data-f="${f}">${l} <b>${cnt(f)}</b></button>`).join("");
    if ($("stats")) drawStats(base);
    let L = base.filter(o => filter === "all" ? true : filter === "open" ? isOpen(o) : filter === "unpaid" ? (isOpen(o) && o.paymentStatus !== "paid") : o.status === filter);
    if (q) L = L.filter(o => [o.ref, o.customer, o.whatsapp, o.child].join(" ").toLowerCase().includes(q));
    document.title = (cnt("new") ? `(${cnt("new")}) ` : "") + (MODE === "admin" ? "Admin portal" : "Back office") + " · Gemini X";
    PP = perPhone();
    $("list").innerHTML = L.length ? L.map(card).join("") : `<div class="o-empty">No orders here yet.</div>`;
  }

  function drawStats(base) {
    const today = new Date().toDateString();
    const sum = a => a.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const tod = base.filter(o => new Date(o.created).toDateString() === today);
    const open = base.filter(isOpen), unpaid = open.filter(o => o.paymentStatus !== "paid"), done = base.filter(o => o.status === "collected");
    const per = C.venues.map(v => { const a = base.filter(o => o.venue === v.id && o.status !== "cancelled"); return `<span>${esc(v.retail || v.name)}: <b>${a.length}</b> · ${money(sum(a))}</span>`; }).join("");
    $("stats").innerHTML = `
      <div class="o-stat"><b>${tod.length}</b><span>orders today</span></div>
      <div class="o-stat"><b>${open.length}</b><span>open orders</span></div>
      <div class="o-stat"><b>${unpaid.length}</b><span>not paid yet · ${money(sum(unpaid))}</span></div>
      <div class="o-stat"><b>${money(sum(done))}</b><span>collected sales</span></div>
      <div class="o-per">${per}</div>`;
  }

  const perPhone = () => orders.reduce((m, x) => (x.status !== "cancelled" && (m[x.whatsapp] = (m[x.whatsapp] || 0) + 1), m), {});
  let PP = {};
  function card(o) {
    const v = venueOf(o.venue), [se, sl] = STATUS[o.status] || ["", o.status], n = PP[o.whatsapp] || 1;
    const items = o.items.map(([id, n]) => { const p = byId[id] || { name: id, price: 0 }; return `<div class="o-it">
        ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<span class="o-noimg">🎁</span>`}
        <div class="o-itn"><b>${n} ×</b> ${esc(p.name)}<small>${p.code ? "Ref " + esc(p.code) + " · " : ""}${money(p.price * n)}</small>
        ${showBc[o.ref] ? `<div class="o-bc">${GX.barcode(p.barcode) || '<small>No barcode</small>'}</div>` : ""}</div></div>`; }).join("");
    const nx = NEXT[o.status];
    const payBtns = o.status === "cancelled" ? "" : (o.paymentStatus === "paid" ? `<button class="obtn ghost" data-act="unpaid">Undo paid</button>` :
      `${o.payment === "link" && o.paymentStatus === "pending" ? `<button class="obtn" data-act="link">📲 Mark link sent</button>` : ""}<button class="obtn green" data-act="paid">💰 Mark paid</button>`);
    return `<article class="o-card s-${esc(o.status)}" data-ref="${esc(o.ref)}">
      <header><div><span class="o-ref">${esc(o.ref)}</span>${role === "admin" ? `<span class="o-ven">${esc(v.retail || v.name)}</span>` : ""}<span class="o-ago">${ago(o.created)}</span></div>
        <span class="o-st">${se} ${sl}</span></header>
      <div class="o-grid">
        <div class="o-who">
          <div class="o-name">${esc(o.customer)}${n > 1 ? ` <button class="o-multi" data-act="same" title="Show all orders from this number">🛍️ ${n} orders</button>` : ""}</div>
          <a class="o-phone" href="https://wa.me/${esc(o.whatsapp)}" target="_blank" rel="noopener">🟢 ${esc(fmtPhone(o.whatsapp))}</a>
          <div class="o-party">🎂 ${esc(o.child)}${o.partyDate ? " · " + esc(niceDate(o.partyDate)) : ""}${o.partyTime ? " · " + esc(o.partyTime) : ""}</div>
          <div class="o-pay"><span class="o-pm">${o.payment === "link" ? "📲 Wants payment link" : "💵 Cash on arrival"}</span><span class="o-ps p-${esc(o.paymentStatus)}">${PAY[o.paymentStatus] || esc(o.paymentStatus)}</span></div>
          ${String(o.wrap || "").replace(/[\s\/]/g, "") || o.card ? `<div class="o-wrap">${String(o.wrap || "").replace(/[\s\/]/g, "") ? "🎀 " + esc(o.wrap) : ""}${o.card ? `<br>💌 “${esc(o.card)}”` : ""}</div>` : ""}
        </div>
        <div class="o-items">${items}<div class="o-tot"><span>Total</span><b>${money(o.total)}</b></div>
          <button class="obtn ghost small" data-act="bc">${showBc[o.ref] ? "Hide barcodes" : "▦ Show barcodes"}</button></div>
      </div>
      <div class="o-actions">
        <button class="obtn wa" data-act="confirm">💬 Confirm on WhatsApp</button>
        ${payBtns}
        ${o.status === "ready" ? `<button class="obtn wa" data-act="readymsg">🎁 Tell them it's ready</button>` : ""}
        ${nx ? `<button class="obtn ink" data-act="next" data-to="${nx[0]}">${nx[1]}</button>` : ""}
        ${isOpen(o) ? `<button class="obtn ghost" data-act="cancel">Cancel</button>` : `<button class="obtn ghost" data-act="reopen">Reopen</button>`}
      </div>
      <textarea class="in-f o-notes" data-act="notes" placeholder="Notes for the team (e.g. paid by card, collected by aunt)">${esc(o.notes)}</textarea>
    </article>`;
  }

  $("app").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b || b.tagName === "TEXTAREA") return;
    const el = b.closest(".o-card"); if (!el) return;
    const o = orders.find(x => x.ref === el.dataset.ref); if (!o) return;
    const act = b.dataset.act;
    if (act === "confirm") wa(o, msg("confirm", o));
    else if (act === "ask") wa(o, msg("ask", o));
    else if (act === "readymsg") wa(o, msg("ready", o));
    else if (act === "link") update(o.ref, { paymentStatus: "link_sent" });
    else if (act === "paid") update(o.ref, { paymentStatus: "paid" });
    else if (act === "unpaid") update(o.ref, { paymentStatus: "pending" });
    else if (act === "next") update(o.ref, { status: b.dataset.to });
    else if (act === "cancel") { if (confirmBox(el, "Cancel this order?")) update(o.ref, { status: "cancelled" }); }
    else if (act === "reopen") update(o.ref, { status: "new" });
    else if (act === "same") { filter = "all"; q = o.whatsapp; $("search").value = "+" + o.whatsapp; draw(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (act === "bc") { showBc[o.ref] = !showBc[o.ref]; draw(); }
  });
  $("app").addEventListener("change", e => {
    if (e.target.dataset.act !== "notes") return;
    const el = e.target.closest(".o-card"); update(el.dataset.ref, { notes: e.target.value });
  });
  // two-tap confirm without browser dialogs
  function confirmBox(el, text) {
    if (el.dataset.sure === "1") { el.dataset.sure = ""; return true; }
    el.dataset.sure = "1"; toast(text + " Tap Cancel again to confirm."); setTimeout(() => el.dataset.sure = "", 4000); return false;
  }

  function exportCsv() {
    const H = ["ref", "created", "venue", "status", "payment", "paymentStatus", "customer", "whatsapp", "child", "partyDate", "partyTime", "items", "total", "notes"];
    const rows = orders.filter(o => !vf || o.venue === vf).map(o => H.map(h => h === "items" ? o.items.map(([id, n]) => n + "x " + (byId[id] ? byId[id].name : id)).join("; ") : o[h]));
    const csv = [H].concat(rows).map(r => r.map(x => `"${String(x == null ? "" : x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = "gift-orders-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
  }

  /* ---------- little helpers ---------- */
  let tt;
  function toast(m) { $("toast").textContent = m; $("toast").classList.add("on"); clearTimeout(tt); tt = setTimeout(() => $("toast").classList.remove("on"), 2400); }
  function flash(n) { toast(`🔔 ${n} new order${n > 1 ? "s" : ""}!`); }
  function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [660, 880].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.15, a.currentTime + i * .18); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + i * .18 + .16); o.start(a.currentTime + i * .18); o.stop(a.currentTime + i * .18 + .17); }); } catch (e) {} }

  if (pin) { try { const j = await api({ action: "login", pin }); role = j.role; if (MODE === "admin" && role !== "admin") throw 0; start(); } catch (e) { showLogin(); } }
  else showLogin();
})();
