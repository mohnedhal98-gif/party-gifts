(async function () {
  const $ = id => document.getElementById(id);
  let C, ALL, S;
  try { ({ config: C, products: ALL, stock: S } = await GX.load()); }
  catch (e) { $("grid").innerHTML = '<div class="empty">The menu could not load. Please refresh the page.</div>'; return; }
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));
  const cur = C.currency || "QAR";

  /* ---------------- link details ---------------- */
  let qs = new URLSearchParams(location.search);
  const hv = location.hash.slice(1);
  if (!location.search && C.venues.some(v => v.id === hv)) qs = new URLSearchParams("v=" + hv); // e.g. …/#wow opens the WoW menu
  else if (!location.search && C.demoParty) qs = new URLSearchParams(C.demoParty); // preview only
  addEventListener("hashchange", () => { if (!location.search) location.reload(); });
  const party = { venue: qs.get("v") || "", child: (qs.get("c") || "").slice(0, 30), date: qs.get("d") || "", time: qs.get("t") || "",
    wish: (qs.get("w") || "").split(",").filter(id => byId[id]), theme: GX.THEMES[qs.get("th")] ? qs.get("th") : "party" };
  const venueOf = id => C.venues.find(v => v.id === id);
  const TH = GX.THEMES[party.theme];

  /* ---------------- saved state (this phone only) ---------------- */
  const KEY = "gx-bag-" + (party.child + party.date || "general");
  let st = { bag: {}, paper: TH.paper, ribbon: "#FFC700", card: "", gname: "", venue: "", sound: false, lang: "" };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  for (const id in st.bag) if (!byId[id]) delete st.bag[id];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  let venue = venueOf(party.venue) ? party.venue : (venueOf(st.venue) ? st.venue : "");

  /* ---------------- language ---------------- */
  let lang = qs.get("lang") === "ar" || qs.get("lang") === "en" ? qs.get("lang") : (st.lang || ((navigator.language || "").startsWith("ar") ? "ar" : "en"));
  const t = (k, v) => { let s = (GX.I18N[lang] && GX.I18N[lang][k]) ?? GX.I18N.en[k] ?? k; if (v) for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; };
  const wName = w => lang === "ar" ? (GX.WORLD_AR[w] || w) : w;
  const thName = () => TH[lang] || TH.en;

  /* ---------------- stock per venue ---------------- */
  const stockMap = () => (venue && S.venues && S.venues[venue]) ? S.venues[venue] : null;
  // safety buffer: hide the last N units of each toy so the shop is never caught short (config "safetyBuffer": 0, 1 or 2)
  const BUF = Math.max(0, Math.min(5, parseInt(C.safetyBuffer) || 0));
  const avail = p => { const m = stockMap(); return m ? Math.max(0, (m[p.id] || 0) - BUF) : 999; };
  const isFew = p => { const m = stockMap(); return m ? (avail(p) > 0 && avail(p) <= 2) : p.few; };
  let P = [];
  const refreshStock = () => { P = ALL.filter(p => avail(p) > 0); };
  refreshStock();

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  root.style.setProperty("--hero", TH.bg); root.style.setProperty("--ac", TH.ac);
  $("artPop").textContent = TH.art;
  // floating toys in the hero
  $("floaties").innerHTML = [TH.art, "🧸", "🎈", "🚀", "🧱", "🦖", "🎁", "⭐"].map((e, i) => `<span style="left:${[6, 18, 34, 52, 64, 78, 88, 44][i]}%;top:${[18, 70, 12, 82, 22, 64, 30, 50][i]}%;animation-delay:-${i * .9}s;font-size:${[38, 30, 34, 28, 36, 30, 32, 26][i]}px" data-depth="${(i % 3) + 1}">${e}</span>`).join("");
  addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    document.querySelectorAll("#floaties span").forEach(s => { const d = +s.dataset.depth * 10; s.style.translate = `${-x * d}px ${-y * d}px`; }); }, { passive: true });
  const LG = C.logoLight || C.logo; if (LG) { $("logo").innerHTML = `<img src="${GX.esc(LG)}" alt="Gemini X">`; $("logo").classList.add("img"); $("flogo").innerHTML = `<img src="${GX.esc(LG)}" alt="Gemini X">`; }

  /* ---------------- sounds & stickers (game feel) ---------------- */
  let actx;
  function blip(kind) {
    if (!st.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === "win" ? [523, 659, 784, 1046] : kind === "tick" ? [880] : [660, 990];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * .07;
        o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.18, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + (kind === "tick" ? .05 : .18));
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .2);
      });
    } catch (e) {}
  }
  const drawSound = () => { $("soundBtn").textContent = st.sound ? "🔊" : "🔇"; $("soundBtn").title = t("sound"); };
  $("soundBtn").onclick = () => { st.sound = !st.sound; save(); drawSound(); blip("add"); };
  function sticker(el) {
    if (!el) return; const r = el.getBoundingClientRect();
    ["⭐", "💖", "🎉", TH.art].forEach((e, i) => {
      const s = Object.assign(document.createElement("span"), { className: "stk", textContent: e });
      s.style.left = r.left + r.width / 2 + "px"; s.style.top = r.top + "px";
      s.style.setProperty("--dx", (i - 1.5) * 34 + "px"); s.style.animationDelay = i * 40 + "ms";
      document.body.appendChild(s); setTimeout(() => s.remove(), 1100);
    });
  }

  /* ---------------- static texts ---------------- */
  const AGES = [["0-2", "👶 0–2"], ["3-5", "🧒 3–5"], ["6-8", "🧑 6–8"], ["9-12", "🧑‍🎤 9–12"], ["13-99", "😎 13+"]];
  const BUDGETS = [["", "anyBudget"], ["0-50", "u50"], ["50-100", "50–100"], ["100-200", "100–200"], ["200-500", "200–500"], ["500-99999", "500+ 👑"]];
  const budgetLabel = ([v, l]) => l === "anyBudget" ? t("anyBudget") : l === "u50" ? t("under") + " 50" : l;

  function applyLang() {
    root.lang = lang; root.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i]").forEach(el => el.innerHTML = t(el.dataset.i));
    document.querySelectorAll("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
    $("langBtn").textContent = t("lang");
    const words = C.shopName.toUpperCase().split(" "), vv = venueOf(venue);
    $("brand").innerHTML = vv && vv.retail
      ? `<span class="rt">${GX.esc(vv.retail.replace(/ Retail$/i, "").toUpperCase())}</span> RETAIL<small class="byx">${t("byGx")}</small>`
      : GX.esc(words.slice(0, -1).join(" ")) + " <span>" + GX.esc(words.slice(-1)[0]) + "</span>";
    $("footShop").textContent = C.shopName;
    $("kicker").textContent = party.child ? t("invited") : t("kicker");
    $("heroTitle").innerHTML = party.child ? t("titleFor", { c: GX.esc(party.child) }) : t("title");
    $("heroText").textContent = party.child ? t("leadFor", { c: party.child }) : t("lead");
    $("artTag").textContent = party.child ? (lang === "ar" ? "إلى " : "For ") + party.child.slice(0, 9) + "!" : (lang === "ar" ? "لك!" : "For you!");
    $("stk1").textContent = lang === "ar" ? "تغليف مجاني!" : "FREE gift wrap!";
    $("stk2").textContent = lang === "ar" ? "نقداً أو رابط دفع 💛" : "Cash or pay by link 💛";
    document.title = (party.child ? t("birthday", { c: party.child }) + " · " : "") + (vv && vv.retail ? vv.retail + " by Gemini X" : C.shopName);
    $("age").innerHTML = `<option value="">${t("anyAge")}</option>` + AGES.map(a => `<option value="${a[0]}">${a[1]} ${t("years")}</option>`).join("");
    $("age").value = F.age;
    $("sort").innerHTML = ["pop", "low", "high"].map(k => `<option value="${k}">${t(k === "pop" ? "topPicks" : k)}</option>`).join(""); $("sort").value = F.sort;
    $("venue").innerHTML = `<option value="">${t("choosePlace")}</option>` + C.venues.map(v => `<option value="${v.id}">${GX.esc(v.name)}</option>`).join(""); $("venue").value = venue;
    $("rule").textContent = t("rule");
    $("more").textContent = "⬇";
    $("wishTitle").innerHTML = "💖 " + (party.child ? GX.esc(party.child) + (lang === "ar" ? " · " : "'s ") : "") + `<em>${t("wishlist")}</em>`;
    $("themeTitle").innerHTML = `${TH.e} ` + t("themeTitle", { t: `<em>${GX.esc(thName())}</em>` });
    const mq = lang === "ar" ? ["🎁 تغليف مجاني", "💌 بطاقة مجانية", "💵 نقداً أو 📲 رابط دفع", "🎉 جاهزة للحفلة", `🧸 ${P.length}+ لعبة`] : ["🎁 FREE GIFT WRAP", "💌 FREE NAME CARD", "💵 CASH OR 📲 PAYMENT LINK", "🎉 READY FOR THE PARTY", `🧸 ${P.length}+ TOYS`];
    const m = mq.map(x => `<span>${x}</span><i>★</i>`).join("");
    $("marquee").innerHTML = m + m + m + m;
    if (S.updated) $("stockNote").textContent = "📦 " + t("stockAt") + ": " + new Date(S.updated).toLocaleString(lang === "ar" ? "ar-QA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    drawSound(); drawChips(); drawVenuePick(); drawWorlds(); drawBudgets(); render(true); drawBag(); drawMinis(); drawHost(); drawTheme();
    if (!$("t2").classList.contains("hide")) drawWrap();
  }
  $("langBtn").onclick = () => { lang = lang === "ar" ? "en" : "ar"; st.lang = lang; save(); applyLang(); };

  /* ---------------- hero bits ---------------- */
  function drawChips() {
    const chips = [];
    if (party.date) chips.push("📅 " + GX.niceDate(party.date) + (party.time ? " · " + party.time : ""));
    if (venueOf(venue)) chips.push("📍 " + venueOf(venue).name);
    if (party.theme !== "party") chips.push(TH.e + " " + thName());
    $("partyChips").innerHTML = chips.map(c => `<span class="chip">${GX.esc(c)}</span>`).join("");
  }
  function drawVenuePick() {
    $("venuePick").classList.toggle("hide", !!party.venue);
    $("venueChips").innerHTML = C.venues.map(v => `<button class="pill ${venue === v.id ? "on" : ""}" data-v="${v.id}">📍 ${GX.esc(v.name)}</button>`).join("");
  }
  $("venueChips").onclick = e => { const b = e.target.closest("[data-v]"); if (b) setVenue(b.dataset.v); };
  function setVenue(v) {
    venue = v; st.venue = v; save(); refreshStock();
    for (const id in st.bag) { const a = avail(byId[id]); if (a <= 0) delete st.bag[id]; else if (st.bag[id] > a) st.bag[id] = a; }
    save(); $("venue").value = v; applyLang();
  }
  $("venue").onchange = () => setVenue($("venue").value);

  if (party.date) {
    const target = new Date(party.date + "T" + (/^\d{1,2}:\d{2}$/.test(party.time) ? party.time.padStart(5, "0") : "16:00") + ":00");
    const tick = () => {
      const ms = target - new Date();
      if (ms <= 0) { $("countdown").innerHTML = `<span class="lbl">${t("partyDay")}</span>`; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      $("countdown").innerHTML = `<span class="lbl">${t("partyIn")}</span>` + [[d, "days"], [h, "hours"], [mi, "mins"], [s, "secs"]]
        .map(([v, l]) => `<div class="tile"><b>${String(v).padStart(2, "0")}</b><small>${t(l)}</small></div>`).join("");
    };
    $("countdown").classList.remove("hide"); tick(); setInterval(tick, 1000);
  }
  $("balloons").innerHTML = Array.from({ length: 9 }, (_, i) => { const c = TH.b[i % TH.b.length];
    return `<i class="balloon" style="left:${(i * 11 + 3) % 96}%;background:${c};border-bottom-color:${c};animation-duration:${14 + (i * 3) % 9}s;animation-delay:-${i * 2.3}s;transform:scale(${.7 + (i % 3) * .2})"></i>`; }).join("");

  /* ---------------- cards ---------------- */
  const inBag = id => st.bag[id] > 0;
  function cardHtml(p) {
    const wl = party.wish.includes(p.id), few = isFew(p), m = stockMap();
    return `<article class="card" data-id="${p.id}">
      <div class="ph" data-open="${p.id}" style="--wt:${GX.world(p.world).c}">${GX.photo(p)}
        ${p.badge ? `<span class="badge b-${p.badge.split(" ")[0]}">${GX.esc(p.badge)}</span>` : ""}
        ${wl ? `<span class="badge wl">💖 ${t("wishlist")}</span>` : ""}
        ${few ? `<span class="few">⏰ ${m ? t("few", { n: avail(p) }) : (lang === "ar" ? "كمية قليلة" : "Few left")}</span>` : ""}
        ${TH.rx && TH.rx.test(p.name) ? `<span class="thm">${TH.e}</span>` : ""}</div>
      <div class="body">
        <div class="name" title="${GX.esc(p.name)}">${GX.esc(p.name)}</div>
        <div class="meta">${GX.world(p.world).e} ${GX.esc(wName(p.world))} · ${GX.age(p, t("years"))}</div>
        <div class="row"><span class="price tagp"><small>${cur}</small>${Number(p.price).toLocaleString("en-US")}</span>
        <button class="add ${inBag(p.id) ? "in" : ""}" data-add="${p.id}">${inBag(p.id) ? t("inBag") : t("add")}</button></div>
      </div></article>`;
  }

  /* ---------------- worlds / filters ---------------- */
  const F = { world: "", budget: "", q: "", age: "", sort: "pop", ids: null, label: "" };
  function drawWorlds() {
    const counts = P.reduce((a, p) => (a[p.world] = (a[p.world] || 0) + 1, a), {});
    const worlds = [{ id: "", e: "🌈", c: "#fff" }, ...GX.WORLDS.filter(w => counts[w.id])];
    if (F.world && !counts[F.world]) F.world = "";
    $("worlds").innerHTML = worlds.map(w => `<button class="world ${F.world === w.id ? "on" : ""}" data-w="${GX.esc(w.id)}"><div class="bub" style="background:${w.c}">${w.e}</div><b>${w.id ? GX.esc(wName(w.id)) : t("allToys")}</b><small>${w.id ? counts[w.id] : P.length} ${t("toys")}</small></button>`).join("");
  }
  $("worlds").onclick = e => { const b = e.target.closest(".world"); if (!b) return; F.world = b.dataset.w; F.ids = null; F.label = ""; page = 1; drawWorlds(); render(true); blip("tick"); };
  const drawBudgets = () => $("budgets").innerHTML = BUDGETS.map(b => `<button class="pill ${F.budget === b[0] ? "on" : ""}" data-b="${b[0]}">${budgetLabel(b)}</button>`).join("");
  $("budgets").onclick = e => { const b = e.target.closest(".pill"); if (!b) return; F.budget = b.dataset.b; F.ids = null; F.label = ""; page = 1; drawBudgets(); render(true); blip("tick"); };
  let qt; $("q").oninput = () => { clearTimeout(qt); qt = setTimeout(() => { F.q = $("q").value.trim().toLowerCase(); F.ids = null; page = 1; render(true); }, 160); };
  $("age").onchange = () => { F.age = $("age").value; F.ids = null; page = 1; render(true); };
  $("sort").onchange = () => { F.sort = $("sort").value; page = 1; render(true); };

  const range = s => s ? s.split("-").map(Number) : [0, 1e9];
  const score = p => (p.image ? 3 : 0) + (p.price >= 60 && p.price <= 250 ? 3 : p.price < 400 ? 1 : 0) + (p.badge === "Surprise box" ? 1 : 0) + (TH.rx && TH.rx.test(p.name) ? 2 : 0) - (isFew(p) ? 1 : 0) + (parseInt(p.id.slice(1)) % 7) / 10;
  function filtered() {
    if (F.ids) return F.ids.map(id => byId[id]).filter(p => avail(p) > 0);
    const [bmin, bmax] = range(F.budget), [amin, amax] = range(F.age);
    let list = P.filter(p => (!F.world || p.world === F.world) && p.price >= bmin && p.price <= bmax &&
      (!F.age || (p.ageMin <= amax && p.ageMax >= amin)) && (!F.q || (p.name + " " + p.world + " " + wName(p.world)).toLowerCase().includes(F.q)));
    if (F.sort === "low") list.sort((a, b) => a.price - b.price);
    else if (F.sort === "high") list.sort((a, b) => b.price - a.price);
    else {
      list.sort((a, b) => score(b) - score(a) || a.price - b.price);
      if (!F.world) {
        const g = {}; list.forEach(p => (g[p.world] = g[p.world] || []).push(p));
        const qs2 = Object.values(g).sort((a, b) => b.length - a.length), mixed = [];
        while (mixed.length < list.length) qs2.forEach(x => x.length && mixed.push(x.shift()));
        list = mixed;
      }
    }
    return list;
  }

  let page = 1; const PER = 24, grid = $("grid"); let shown = 0, lastList = [];
  function render(fresh) {
    const list = filtered(); lastList = list;
    const paint = () => {
      if (!list.length) { grid.innerHTML = `<div class="empty">${t("noMatch")}</div>`; shown = 0; }
      else if (fresh || shown === 0 || page * PER < shown) { grid.innerHTML = list.slice(0, page * PER).map(cardHtml).join(""); shown = Math.min(list.length, page * PER); reveal(grid); }
      else if (page * PER > shown) { grid.insertAdjacentHTML("beforeend", list.slice(shown, page * PER).map(cardHtml).join("")); shown = Math.min(list.length, page * PER); reveal(grid); }
      $("more").classList.toggle("hide", list.length <= shown);
    };
    if (fresh && grid.children.length) { grid.classList.add("swap"); setTimeout(() => { paint(); grid.classList.remove("swap"); }, 160); } else paint();
    $("resultLine").innerHTML = `<span>🎁 ${list.length} ${list.length === 1 ? t("gift") : t("gifts")}${F.label ? " · " + GX.esc(F.label) : ""}</span>` +
      (F.ids || F.world || F.budget || F.q || F.age ? `<button id="clearF">${t("clear")}</button>` : "");
    const wish = party.wish.map(id => byId[id]).filter(p => avail(p) > 0);
    $("wishSec").classList.toggle("hide", !wish.length);
    if (fresh || !$("wishGrid").children.length) { $("wishGrid").innerHTML = wish.map(cardHtml).join(""); reveal($("wishGrid")); }
    syncButtons();
  }
  function syncButtons() {
    document.querySelectorAll("[data-add]").forEach(b => {
      if (!b.closest(".card")) return;
      const on = inBag(b.dataset.add); b.classList.toggle("in", on); b.textContent = on ? t("inBag") : t("add");
    });
    $("count").textContent = Object.values(st.bag).reduce((a, b) => a + b, 0);
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const el = e.target; io.unobserve(el);
    el.style.transitionDelay = (el.dataset.d || 0) + "ms"; el.classList.add("in-view"); setTimeout(() => { el.style.transitionDelay = ""; }, 900);
  }), { rootMargin: "0px 0px -6% 0px" }) : null;
  function reveal(rootEl) {
    [...rootEl.querySelectorAll(".card:not(.rv)")].forEach((c, i) => { c.classList.add("rv"); c.dataset.d = (i % 5) * 55; io ? io.observe(c) : c.classList.add("in-view"); });
    rootEl.querySelectorAll("img").forEach(im => { if (im.complete) im.classList.add("ld"); else im.addEventListener("load", () => im.classList.add("ld"), { once: true }); });
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es[0].isIntersecting && lastList.length > shown) { page++; render(); } }, { rootMargin: "600px" }).observe($("more"));
  $("more").onclick = () => { page++; render(); };
  $("resultLine").onclick = e => {
    if (e.target.id !== "clearF") return;
    Object.assign(F, { world: "", budget: "", q: "", age: "", ids: null, label: "" });
    $("q").value = ""; $("age").value = ""; page = 1; drawWorlds(); drawBudgets(); render(true);
  };

  /* ---------------- theme rail ---------------- */
  function drawTheme() {
    const list = TH.rx ? P.filter(p => TH.rx.test(p.name) && p.image).sort((a, b) => score(b) - score(a)).slice(0, 12) : [];
    $("themeSec").classList.toggle("hide", list.length < 3);
    $("themeRail").innerHTML = list.map(cardHtml).join(""); reveal($("themeRail"));
    $("themeRail").querySelectorAll(".card").forEach(c => c.classList.add("in-view"));
  }

  /* ---------------- add to bag ---------------- */
  function add(id, from, btn) {
    const a = avail(byId[id]);
    if ((st.bag[id] || 0) + 1 > a) { toast(t("maxStock", { n: a })); return; }
    st.bag[id] = (st.bag[id] || 0) + 1; save();
    const src = from && from.querySelector("img");
    if (src) {
      const r = src.getBoundingClientRect(), tg = $("openBasket").getBoundingClientRect();
      const f = Object.assign(document.createElement("img"), { src: src.src, className: "fly" });
      f.style.left = r.left + r.width / 2 - 30 + "px"; f.style.top = r.top + r.height / 2 - 30 + "px";
      document.body.appendChild(f);
      requestAnimationFrame(() => { f.style.left = tg.left + tg.width / 2 - 15 + "px"; f.style.top = tg.top + "px"; f.style.transform = "scale(.4) rotate(20deg)"; f.style.opacity = ".3"; });
      setTimeout(() => f.remove(), 750);
    }
    sticker(btn); blip("add");
    setTimeout(() => { $("openBasket").classList.remove("bump"); void $("openBasket").offsetWidth; $("openBasket").classList.add("bump"); }, src ? 600 : 0);
    toast(t("added")); syncButtons(); drawBag();
  }
  function remove(id) { delete st.bag[id]; save(); syncButtons(); drawBag(); toast(t("removed")); }
  document.body.addEventListener("click", e => {
    const a = e.target.closest("[data-add]");
    if (a) { const id = a.dataset.add; if (inBag(id) && a.closest(".card")) remove(id); else add(id, a.closest(".card") || a.closest(".modal") || a.closest(".extra"), a); if (a.closest(".modal") && a.dataset.close) closeModal(); return; }
    const o = e.target.closest("[data-open]");
    if (o) openProduct(o.dataset.open);
  });

  /* ---------------- modal ---------------- */
  function openModal(html) { $("mBody").innerHTML = html; $("modal").classList.add("on"); $("shade").classList.add("on"); $("modal").scrollTop = 0; document.body.classList.add("lock"); reveal($("mBody")); $("mBody").querySelectorAll(".card").forEach(c => c.classList.add("in-view")); }
  function closeModal() { $("modal").classList.remove("on"); if (!$("drawer").classList.contains("on")) { $("shade").classList.remove("on"); document.body.classList.remove("lock"); } }
  $("mClose").onclick = closeModal;
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); openBag(false); } });
  const mini = s => `<button class="mini" data-open="${s.id}">${s.image ? `<img src="${s.image}" alt="">` : `<span class="emo">${s.emoji}</span>`}<span>${GX.esc(s.name)}</span><b>${cur} ${s.price}</b></button>`;
  function openProduct(id) {
    const p = byId[id], w = GX.world(p.world), m = stockMap();
    const similar = P.filter(x => x.world === p.world && x.id !== p.id && Math.abs(x.price - p.price) < Math.max(40, p.price * .4)).slice(0, 4);
    openModal(`<div class="pm"><div class="pimg">${GX.photo(p)}</div><div class="pinfo">
      <div class="tags"><span style="background:${w.c}">${w.e} ${GX.esc(wName(p.world))}</span><span>🎂 ${GX.age(p, t("years"))}</span>${p.badge ? `<span>⭐ ${GX.esc(p.badge)}</span>` : ""}${isFew(p) && m ? `<span>⏰ ${t("few", { n: avail(p) })}</span>` : ""}</div>
      <h3>${GX.esc(p.name)}</h3>
      <div class="price" style="font-size:34px"><small>${cur}</small>${Number(p.price).toLocaleString("en-US")}</div>
      <div class="note" style="margin-top:0">${t("freeWrapNote")}</div>
      <button class="bigbtn" data-add="${p.id}" data-close="1">${inBag(p.id) ? t("addOne") : t("addBag")}</button>
      ${similar.length ? `<div><b style="font-family:var(--fd);font-size:18px">${t("alsoLike")}</b><div class="mini-grid" style="max-height:none;grid-template-columns:repeat(4,1fr);margin-top:6px">${similar.map(mini).join("")}</div></div>` : ""}
    </div></div>`);
  }

  /* ---------------- gift finder ---------------- */
  const LIKES = [
    { e: "🏎️", en: "Speed & cars", ar: "السرعة والسيارات", w: ["RC & Speed", "Tracks & Trains"] },
    { e: "🧱", en: "Building", ar: "البناء", w: ["Build It"] },
    { e: "🍳", en: "Pretend play", ar: "لعب الأدوار", w: ["Pretend Play"] },
    { e: "🧸", en: "Cuddly & cute", ar: "دمى ناعمة", w: ["Cuddly & Dolls"] },
    { e: "🎨", en: "Making things", ar: "الرسم والأشغال", w: ["Arts & DIY"] },
    { e: "🎯", en: "Action & sport", ar: "الحركة والرياضة", w: ["Blasters & Sports"] },
    { e: "🏖️", en: "Water & sand", ar: "الماء والرمل", w: ["Beach & Water"] },
    { e: "🚀", en: "Space & science", ar: "الفضاء والعلوم", rx: /space|rocket|astronaut|robot|gear|stem|educational/i },
    { e: "🦖", en: "Dinosaurs", ar: "الديناصورات", rx: /dino/i },
    { e: "🦄", en: "Princess & pink", ar: "الأميرات والوردي", rx: /princess|pink|flower|unicorn|fairy|girls|nanci/i },
    { e: "👶", en: "Baby toys", ar: "ألعاب الرضع", w: ["Baby & Ride-On"] },
    { e: "🤷", en: "Not sure", ar: "لست متأكداً", any: true }
  ];
  const wiz = { step: 1, age: "", likes: [], budget: "" };
  function drawWiz() {
    const prog = `<div class="prog">${[1, 2, 3].map(i => `<i class="${i <= wiz.step ? "on" : ""}"></i>`).join("")}</div>`;
    let h = "";
    if (wiz.step === 1) h = `<h3>${t("fAge", { c: party.child ? GX.esc(party.child) : t("fAgeStar") })}</h3><p>${t("fStep", { n: 1 })}</p><div class="opts">${AGES.map(([v, l]) => `<button class="opt ${wiz.age === v ? "on" : ""}" data-age="${v}"><span class="e">${l.split(" ")[0]}</span>${l.split(" ")[1]} ${t("years")}</button>`).join("")}</div>`;
    if (wiz.step === 2) h = `<h3>${t("fLove")}</h3><p>${t("fStep", { n: 2 })} · ${t("fLoveT")}</p><div class="opts">${LIKES.map((l, i) => `<button class="opt ${wiz.likes.includes(i) ? "on" : ""}" data-like="${i}"><span class="e">${l.e}</span>${l[lang]}</button>`).join("")}</div>`;
    if (wiz.step === 3) h = `<h3>${t("fBudget")}</h3><p>${t("fStep", { n: 3 })}</p><div class="opts">${BUDGETS.slice(1).map((b, i) => `<button class="opt ${wiz.budget === b[0] ? "on" : ""}" data-bud="${b[0]}"><span class="e">${["🪙", "💵", "💰", "💎", "👑"][i]}</span>${cur} ${budgetLabel(b).replace(" 👑", "")}</button>`).join("")}<button class="opt ${wiz.budget === "" ? "on" : ""}" data-bud=""><span class="e">✨</span>${t("anyBudget").replace("💸 ", "")}</button></div>`;
    if (wiz.step === 4) {
      const res = finderResults(); if (res.length) setTimeout(() => { burst(innerWidth / 2, innerHeight / 4, 60); blip("win"); }, 150);
      h = `<h3>${t("perfect")}</h3><p>${res.length ? t("found", { n: res.length }) : t("noFound")}</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${res.slice(0, 6).map(cardHtml).join("")}</div>
        ${res.length > 6 ? `<button class="cta ink more" id="wizAll">${t("seeMatches", { n: res.length })}</button>` : ""}`;
    }
    const foot = wiz.step < 4 ? `<div class="wiz-foot"><button class="cta" id="wizBack" ${wiz.step === 1 ? "style='visibility:hidden'" : ""}>${t("back")}</button><button class="cta pink" id="wizNext">${wiz.step === 3 ? t("fShow") : t("next")}</button></div>` : `<div class="wiz-foot"><button class="cta" id="wizAgain">${t("again")}</button></div>`;
    openModal(`<div class="wiz">${prog}${h}${foot}</div>`);
  }
  function finderResults() {
    const [amin, amax] = range(wiz.age), [bmin, bmax] = range(wiz.budget);
    const likes = wiz.likes.map(i => LIKES[i]).filter(l => !l.any);
    return P.filter(p => (!wiz.age || (p.ageMin <= amax && p.ageMax >= amin)) && p.price >= bmin && p.price <= bmax &&
      (!likes.length || likes.some(l => (l.w && l.w.includes(p.world)) || (l.rx && l.rx.test(p.name))))).sort((a, b) => score(b) - score(a));
  }
  $("mBody").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.age !== undefined) { wiz.age = b.dataset.age; wiz.step = 2; drawWiz(); blip("tick"); }
    else if (b.dataset.like !== undefined) { const i = +b.dataset.like; wiz.likes = wiz.likes.includes(i) ? wiz.likes.filter(x => x !== i) : [...wiz.likes, i]; b.classList.toggle("on"); blip("tick"); }
    else if (b.dataset.bud !== undefined) { wiz.budget = b.dataset.bud; wiz.step = 4; drawWiz(); }
    else if (b.id === "wizNext") { wiz.step++; drawWiz(); }
    else if (b.id === "wizBack") { wiz.step--; drawWiz(); }
    else if (b.id === "wizAgain") { Object.assign(wiz, { step: 1, age: "", likes: [], budget: "" }); drawWiz(); }
    else if (b.id === "wizAll") { F.ids = finderResults().map(p => p.id); F.label = t("finderPicks"); page = 1; closeModal(); render(true); $("menu").scrollIntoView({ behavior: "smooth" }); }
    else if (b.id === "spinAgain") surprise();
  });
  const finder = () => { wiz.step = 1; drawWiz(); };
  ["topFinder", "heroFinder", "bandFinder"].forEach(id => $(id).onclick = finder);

  /* ---------------- surprise me ---------------- */
  function surprise() {
    const [bmin, bmax] = range(F.budget);
    let list = P.filter(p => p.image && p.price >= bmin && p.price <= bmax && (!F.world || p.world === F.world));
    if (!list.length) list = P.filter(p => p.image);
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    openModal(`<div class="slot"><h3 style="font-size:32px">${t("machine")}</h3><div class="reel spin" id="reel"><img alt=""></div><h3 id="slotName">${t("spinning")}</h3><div id="slotAct"></div></div>`);
    let n = 0; const img = $("reel").querySelector("img"); img.classList.add("ld");
    const spin = () => {
      const r = n < 16 ? list[Math.floor(Math.random() * list.length)] : pick;
      img.src = r.image; $("slotName").textContent = n < 16 ? t("spinning") : pick.name; blip("tick");
      if (n++ < 16) setTimeout(spin, 60 + n * 9);
      else {
        $("reel").classList.remove("spin"); burst(innerWidth / 2, innerHeight / 2, 70); blip("win");
        $("slotAct").innerHTML = `<div class="price" style="font-size:30px;margin:6px 0 12px"><small>${cur}</small>${pick.price}</div>
          <div class="hero-ctas" style="justify-content:center;margin-top:0"><button class="cta pink" data-add="${pick.id}" data-close="1">${t("addBag")}</button><button class="cta" id="spinAgain">${t("spinAgain")}</button></div>`;
      }
    };
    spin();
  }
  ["heroSurprise", "bandSurprise"].forEach(id => $(id).onclick = surprise);

  /* ---------------- return gifts ---------------- */
  let hostPick = "";
  const drawMinis = () => {
    const minis = P.filter(p => p.price <= 40 && p.image).sort((a, b) => (b.badge === "Return gift") - (a.badge === "Return gift") || a.price - b.price).slice(0, 36);
    if (hostPick && !minis.find(p => p.id === hostPick)) hostPick = "";
    $("miniGrid").innerHTML = minis.map(p => `<button class="mini ${hostPick === p.id ? "on" : ""}" data-mini="${p.id}"><img src="${p.image}" alt=""><span>${GX.esc(p.name)}</span><b>${cur} ${p.price}</b></button>`).join("");
  };
  const kidsN = () => Math.max(1, Math.min(200, parseInt($("kids").value) || 1));
  const drawHost = () => { $("hostTotal").textContent = hostPick ? `${kidsN()} × ${cur} ${byId[hostPick].price} = ${GX.money(kidsN() * byId[hostPick].price, cur)}` : t("pickReturn"); };
  $("miniGrid").onclick = e => { const b = e.target.closest("[data-mini]"); if (!b) return; hostPick = b.dataset.mini; drawMinis(); drawHost(); blip("tick"); };
  $("kMinus").onclick = () => { $("kids").value = kidsN() - 1; drawHost(); };
  $("kPlus").onclick = () => { $("kids").value = kidsN() + 1; drawHost(); };
  $("kids").oninput = drawHost;
  $("hostSend").onclick = () => {
    if (!hostPick) { toast(t("pickFirst")); return; }
    const a = avail(byId[hostPick]), n = Math.min(kidsN(), a);
    st.bag[hostPick] = n; save(); syncButtons(); drawBag(); openBag(true); blip("add");
    toast(n < kidsN() ? t("maxStock", { n: a }) : t("returnAdded", { n }));
  };

  /* ---------------- gift bag ---------------- */
  const openBag = on => { document.body.classList.toggle("lock", on); $("drawer").classList.toggle("on", on); $("shade").classList.toggle("on", on || $("modal").classList.contains("on")); if (on) { closeModal(); tab(1); } };
  $("openBasket").onclick = () => openBag(true);
  $("closeBasket").onclick = () => openBag(false);
  $("shade").onclick = () => { closeModal(); openBag(false); };
  const bagIds = () => Object.keys(st.bag).filter(id => byId[id] && st.bag[id] > 0);
  const bagTotal = () => bagIds().reduce((a, id) => a + byId[id].price * st.bag[id], 0);
  function tab(n) {
    if (n > 1 && !bagIds().length) n = 1;
    [1, 2, 3].forEach(i => { const el = $("t" + i); el.classList.toggle("hide", i !== n); if (i === n) { el.classList.remove("tabin"); void el.offsetWidth; el.classList.add("tabin"); } });
    document.querySelectorAll(".dtab").forEach(b => { b.classList.toggle("on", +b.dataset.t === n); b.disabled = +b.dataset.t > 1 && !bagIds().length; });
    if (n === 2) drawWrap();
    $("drawer").querySelector(".dbody").scrollTop = 0;
  }
  document.querySelectorAll(".dtab").forEach(b => b.onclick = () => tab(+b.dataset.t));
  $("toWrap").onclick = () => tab(2);
  $("toReserve").onclick = () => tab(3);
  function drawBag() {
    const ids = bagIds();
    $("lines").innerHTML = ids.length ? ids.map(id => {
      const p = byId[id];
      return `<div class="line"><div class="th">${GX.photo(p)}</div><div class="nm">${GX.esc(p.name)}<div class="meta">${GX.money(p.price, cur)}</div></div>
        <div class="qty"><button data-q="-1" data-id="${id}" aria-label="Less">−</button><b>${st.bag[id]}</b><button data-q="1" data-id="${id}" aria-label="More">+</button></div></div>`;
    }).join("") : `<div class="empty" style="padding:30px 10px">${t("bagEmpty")}<br><small>${t("bagEmptyT")}</small></div>`;
    $("lines").querySelectorAll("img").forEach(i => i.classList.add("ld"));
    $("total").textContent = GX.money(bagTotal(), cur);
    $("toWrap").disabled = !ids.length;
    document.querySelectorAll(".dtab").forEach(b => b.disabled = +b.dataset.t > 1 && !ids.length);
    const ex = ids.length ? P.filter(p => p.price <= 30 && p.image && !inBag(p.id)).sort((a, b) => score(b) - score(a)).slice(0, 4) : [];
    $("extrasBox").classList.toggle("hide", !ex.length);
    $("extras").innerHTML = ex.map(p => `<div class="extra"><img class="ld" src="${p.image}" alt=""><span>${GX.esc(p.name)}</span><b>${cur} ${p.price}</b><button data-add="${p.id}" aria-label="Add">+</button></div>`).join("");
  }
  $("lines").onclick = e => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    const id = b.dataset.id, nq = (st.bag[id] || 0) + Number(b.dataset.q), a = avail(byId[id]);
    if (nq > a) { toast(t("maxStock", { n: a })); return; }
    if (nq <= 0) delete st.bag[id]; else st.bag[id] = nq;
    save(); drawBag(); syncButtons(); blip("tick");
  };

  /* ---------------- wrap studio ---------------- */
  const PAPERS = {
    confetti: { en: "Confetti", ar: "قصاصات", bg: "#FF4F8B", art: `<circle cx="6" cy="6" r="3" fill="#FFC700"/><rect x="18" y="16" width="6" height="3" rx="1" fill="#fff" transform="rotate(30 21 17)"/><circle cx="24" cy="4" r="2" fill="#38B6FF"/><rect x="4" y="22" width="5" height="3" rx="1" fill="#38B6FF" transform="rotate(-25 6 23)"/>` },
    stars: { en: "Stars", ar: "نجوم", bg: "#38B6FF", art: `<path d="M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3 4.3 13.3l.8-4.1L2 6.3l4.2-.5z" fill="#FFC700"/><circle cx="23" cy="22" r="2" fill="#fff"/>` },
    stripes: { en: "Stripes", ar: "خطوط", bg: "#FFC700", art: `<path d="M-4 8L8 -4M0 28L28 0M20 32L32 20" stroke="#fff" stroke-width="5"/>` },
    hearts: { en: "Hearts", ar: "قلوب", bg: "#FFE4EE", art: `<path d="M8 12s-6-3.6-6-7.2C2 3 3.3 2 4.8 2 6.2 2 7.4 3 8 4c.6-1 1.8-2 3.2-2C12.7 2 14 3 14 4.8 14 8.4 8 12 8 12z" fill="#FF4F8B"/><circle cx="23" cy="22" r="2" fill="#FF4F8B"/>` },
    dinos: { en: "Dinos", ar: "ديناصورات", bg: "#2BD67B", art: `<text x="2" y="14" font-size="12">🦖</text><circle cx="24" cy="24" r="2" fill="#fff"/>` },
    space: { en: "Space", ar: "فضاء", bg: "#1B1530", art: `<text x="2" y="14" font-size="11">🚀</text><circle cx="23" cy="22" r="1.6" fill="#FFC700"/><circle cx="14" cy="27" r="1" fill="#fff"/>` },
    unicorn: { en: "Unicorns", ar: "يونيكورن", bg: "#C4B5FD", art: `<text x="2" y="14" font-size="12">🦄</text><circle cx="23" cy="23" r="2" fill="#fff"/>` },
    gold: { en: "Gold", ar: "ذهبي", bg: "#E9B10A", art: `<circle cx="8" cy="8" r="1.4" fill="#fff8"/><circle cx="22" cy="20" r="1.2" fill="#fff8"/><path d="M15 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#fff"/>` }
  };
  if (!PAPERS[st.paper]) st.paper = "confetti";
  const RIBBONS = { "#FFC700": ["Yellow", "أصفر"], "#FF4F8B": ["Pink", "وردي"], "#38B6FF": ["Blue", "أزرق"], "#ffffff": ["White", "أبيض"], "#2BD67B": ["Green", "أخضر"], "#8B5CF6": ["Purple", "بنفسجي"] };
  const pat = (k, id) => `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="${PAPERS[k].bg}"/>${PAPERS[k].art}</pattern>`;
  function drawWrap() {
    $("papers").innerHTML = Object.keys(PAPERS).map(k => `<button class="paper ${st.paper === k ? "on" : ""}" data-p="${k}"><svg width="100%" height="100%"><defs>${pat(k, "pp-" + k)}</defs><rect width="100%" height="100%" fill="url(#pp-${k})"/></svg><span>${PAPERS[k][lang]}</span></button>`).join("");
    $("ribbons").innerHTML = Object.keys(RIBBONS).map(c => `<button class="rib ${st.ribbon === c ? "on" : ""}" data-r="${c}" style="background:${c}" aria-label="${RIBBONS[c][0]}"></button>`).join("");
    $("card").value = st.card; drawPreview();
  }
  function drawPreview() {
    const r = st.ribbon, k = st.paper, to = ($("child").value || party.child || "").trim(), msg = (st.card || t("cardPh").split("!")[0] + "!").trim();
    const lines = []; let line = "";
    msg.split(" ").forEach(w => { if ((line + " " + w).trim().length > 20) { lines.push(line.trim()); line = w; } else line += " " + w; }); lines.push(line.trim());
    $("preview").innerHTML = `<svg viewBox="0 0 320 230" direction="ltr"><defs>${pat(k, "pv")}</defs>
      <ellipse cx="135" cy="214" rx="100" ry="10" fill="#1B153022"/>
      <rect x="40" y="96" width="190" height="116" rx="12" fill="url(#pv)" stroke="#1B1530" stroke-width="5"/>
      <rect x="40" y="70" width="190" height="34" rx="10" fill="url(#pv)" stroke="#1B1530" stroke-width="5"/>
      <rect x="120" y="70" width="30" height="142" fill="${r}" stroke="#1B1530" stroke-width="5"/>
      <path d="M135 70 C98 24 62 44 86 68 Z" fill="${r}" stroke="#1B1530" stroke-width="5" stroke-linejoin="round"/>
      <path d="M135 70 C172 24 208 44 184 68 Z" fill="${r}" stroke="#1B1530" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="135" cy="68" r="10" fill="${r}" stroke="#1B1530" stroke-width="5"/>
      <path d="M150 110 Q205 120 214 140" fill="none" stroke="#1B1530" stroke-width="2" stroke-dasharray="4 3"/>
      <g transform="rotate(8 262 152)"><rect x="200" y="112" width="116" height="${70 + lines.length * 14}" rx="10" fill="#fff" stroke="#1B1530" stroke-width="4"/>
      <circle cx="212" cy="126" r="4" fill="none" stroke="#1B1530" stroke-width="2"/>
      <text x="258" y="138" text-anchor="middle" font-family="Baloo 2,Nunito,sans-serif" font-weight="800" font-size="15" fill="#FF4F8B">${to ? (lang === "ar" ? "إلى " : "To ") + GX.esc(to.slice(0, 12)) : (lang === "ar" ? "إلى النجم" : "To the star")}</text>
      ${lines.slice(0, 4).map((l, i) => `<text x="258" y="${158 + i * 15}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="11.5" fill="#1B1530">${GX.esc(l)}</text>`).join("")}
      <text x="258" y="${168 + Math.min(lines.length, 4) * 15}" text-anchor="middle" font-size="13">💛</text></g></svg>`;
  }
  $("papers").onclick = e => { const b = e.target.closest("[data-p]"); if (!b) return; st.paper = b.dataset.p; save(); drawWrap(); blip("tick"); };
  $("ribbons").onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; st.ribbon = b.dataset.r; save(); drawWrap(); blip("tick"); };
  $("card").oninput = () => { st.card = $("card").value; save(); drawPreview(); };
  $("child").oninput = drawPreview;

  /* ---------------- gift list (ticket) ---------------- */
  $("child").value = party.child; $("pdate").value = party.date; $("gname").value = st.gname || "";
  $("gname").oninput = () => { st.gname = $("gname").value; save(); };
  $("wa").value = st.wa || "";
  $("wa").oninput = () => { st.wa = $("wa").value; save(); };
  const phoneOf = v => { let d = String(v || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length === 8) d = "974" + d; return d; };
  const fmtPhone = d => d.startsWith("974") && d.length === 11 ? "+974 " + d.slice(3, 7) + " " + d.slice(7) : "+" + d;
  const drawPay = () => document.querySelectorAll(".payopt").forEach(b => b.classList.toggle("on", b.dataset.pay === st.pay));
  $("paygrid").onclick = e => { const b = e.target.closest("[data-pay]"); if (!b) return; st.pay = b.dataset.pay; save(); drawPay(); blip("tick"); };
  drawPay();
  let sending = false;
  $("reserve").onclick = async () => {
    if (sending) return;
    const err = m => { $("err").textContent = m ? "⚠️ " + m : ""; };
    const ids = bagIds();
    if (!ids.length) return err(t("eGift"));
    if (!$("venue").value) return err(t("ePlace"));
    if (!$("child").value.trim()) return err(t("eChild"));
    if (!$("pdate").value) return err(t("eDate"));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date($("pdate").value + "T00:00:00") < today) return err(t("ePast"));
    if (!$("gname").value.trim()) return err(t("eName"));
    const phone = phoneOf($("wa").value);
    if (phone.length < 11 || phone.length > 15) return err(t("ePhone"));
    if (!st.pay) return err(t("ePay"));
    err("");
    const tk = { ref: "", made: new Date().toISOString(), venue: $("venue").value, child: $("child").value.trim(), date: $("pdate").value, time: party.time,
      from: $("gname").value.trim(), phone, pay: st.pay, items: ids.map(id => [id, st.bag[id]]), paper: st.paper, ribbon: st.ribbon, card: st.card.trim(), theme: party.theme };
    if (C.ordersApi) {
      sending = true; const btn = $("reserve"), was = btn.innerHTML; btn.disabled = true; btn.innerHTML = "⏳ " + t("sending");
      try {
        const r = await fetch(C.ordersApi, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "create", order: {
          venue: tk.venue, customer: tk.from, whatsapp: phone, child: tk.child, partyDate: tk.date, partyTime: tk.time, payment: tk.pay,
          items: tk.items, paper: (PAPERS[tk.paper] || {}).en || tk.paper, ribbon: (RIBBONS[tk.ribbon] || [tk.ribbon])[0], card: tk.card, lang } }) });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "error");
        tk.ref = j.ref;
      } catch (e) {
        sending = false; btn.disabled = false; btn.innerHTML = was;
        return err(e && e.message && e.message !== "Failed to fetch" && !/JSON|network/i.test(e.message) ? e.message : t("eSend"));
      }
      sending = false; btn.disabled = false; btn.innerHTML = was;
    } else tk.ref = "GX-" + Date.now().toString(36).toUpperCase().slice(-5);
    st.ticket = tk; st.bag = {}; save(); syncButtons(); drawBag(); openBag(false); showTicket(true);
  };
  function showTicket(fresh) {
    const tk = st.ticket; if (!tk) return;
    const items = tk.items.filter(([id]) => byId[id]);
    const total = items.reduce((a, [id, q]) => a + byId[id].price * q, 0), count = items.reduce((a, [, q]) => a + q, 0), v = venueOf(tk.venue);
    openModal(`<div class="ticket">
      ${tk.phone ? `<div class="tk-ok"><b>${t("orderTitle")}</b><span>${t(tk.pay === "link" ? "weWa" : "weWaCash", { n: GX.esc(fmtPhone(tk.phone)) })}</span></div>` : ""}
      <div class="tk-head"><div><div class="tk-k">${tk.phone ? t("orderNo") : t("listTitle")}</div><div class="tk-ref">${GX.esc(tk.ref)}</div></div>
        <div class="tk-party"><b>${GX.esc(t("birthday", { c: tk.child }))}</b><span>📅 ${GX.niceDate(tk.date)}${tk.time ? " · " + GX.esc(tk.time) : ""}</span><span>📍 ${GX.esc(v ? v.name : "")}</span>${tk.from ? `<span>💛 ${t("from")} ${GX.esc(tk.from)}</span>` : ""}</div></div>
      <p class="tk-hint">${t("showShop")}</p>
      <div class="tk-items">${items.map(([id, q], n) => { const p = byId[id]; return `<div class="tk-item">
        <div class="tk-ph">${GX.photo(p)}</div>
        <div class="tk-info"><div class="tk-n" dir="ltr"><b>${n + 1}.</b> ${GX.esc(p.name)}</div>
          <div class="tk-m"><span class="tk-q">× ${q}</span><span>${GX.money(p.price * q, cur)}</span>${p.code ? `<span class="tk-c">Ref ${GX.esc(p.code)}</span>` : ""}</div>
          <div class="tk-bc" dir="ltr">${GX.barcode(p.barcode) || `<span class="meta">${t("noBarcode")}</span>`}</div></div></div>`; }).join("")}</div>
      <div class="tk-wrap"><div class="tk-sw"><svg width="100%" height="100%"><defs>${pat(tk.paper, "tkp")}</defs><rect width="100%" height="100%" fill="url(#tkp)"/><rect x="42%" width="16%" height="100%" fill="${tk.ribbon}"/></svg></div>
        <div><b>🎀 ${t("wrap")}:</b> ${PAPERS[tk.paper][lang]} · ${(RIBBONS[tk.ribbon] || ["", ""])[lang === "ar" ? 1 : 0]}<br><b>💌 ${t("card")}:</b> ${tk.card ? "“" + GX.esc(tk.card) + "”" : t("cardPh").split("!")[0] + "!"}</div></div>
      <div class="tk-total"><span>${count} ${count > 1 ? t("items") : t("item")} · ${tk.pay ? (tk.pay === "link" ? t("payLinkTk") : t("payCashTk")) : t("payAtShop")}</span><span class="tk-right"><span class="tk-stamp">🎀 FREE<br>WRAP</span><b>${GX.money(total, cur)}</b></span></div>
      <div class="hero-ctas" style="justify-content:center">${tk.phone ? "" : `<button class="cta" id="tkEdit">${t("edit")}</button>`}<button class="cta ink" id="tkNew">${t("done")}</button></div>
      <p class="tk-hint" style="text-align:center;margin-top:10px">${t("tip")}</p></div>`);
    $("mBody").querySelectorAll("img").forEach(i => i.classList.add("ld"));
    $("openTicket").classList.remove("hide");
    if ($("tkEdit")) $("tkEdit").onclick = () => { closeModal(); openBag(true); };
    $("tkNew").onclick = closeModal;
    if (fresh) { setTimeout(() => burst(innerWidth / 2, 60, 120), 100); blip("win"); }
  }
  $("openTicket").onclick = () => showTicket();
  if (st.ticket) $("openTicket").classList.remove("hide");

  /* ---------------- confetti ---------------- */
  const cv = $("fx"), cx = cv.getContext("2d"); let parts = [], raf = 0;
  const size = () => { cv.width = innerWidth; cv.height = innerHeight; }; size(); addEventListener("resize", size);
  function burst(x, y, n) {
    const cols = [TH.bg, TH.ac, "#FFC700", "#FF4F8B", "#38B6FF", "#2BD67B", "#ffffff"];
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - .5) * 16, vy: Math.random() * -15 - 4, r: Math.random() * 6 + 4, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .4, life: 110 });
    if (!raf) loop();
  }
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life-- > 0 && p.y < cv.height + 20);
    parts.forEach(p => { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); });
    raf = parts.length ? requestAnimationFrame(loop) : (cx.clearRect(0, 0, cv.width, cv.height), 0);
  }
  let tt;
  function toast(m) { $("toast").textContent = m; $("toast").classList.add("on"); clearTimeout(tt); tt = setTimeout(() => $("toast").classList.remove("on"), 1700); }

  /* ---------------- start ---------------- */
  addEventListener("scroll", () => document.querySelector(".top").classList.toggle("scrolled", scrollY > 10), { passive: true });
  if ("IntersectionObserver" in window) new IntersectionObserver(es => $("balloons").classList.toggle("paused", !es[0].isIntersecting)).observe(document.querySelector(".hero"));
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => { const tg = document.querySelector(a.getAttribute("href")); if (tg) { e.preventDefault(); tg.scrollIntoView({ behavior: "smooth" }); } }));
  applyLang();
  document.body.classList.add("ready");
  { const pics = P.filter(p => p.image && (!TH.rx || TH.rx.test(p.name))).concat(P.filter(p => p.image)).slice(0, 12); let k = 0;
    const swap = () => { if (!pics.length) return; $("popImg").setAttribute("href", pics[k++ % pics.length].image); $("artPop").style.display = "none"; };
    swap(); document.querySelector(".giftart .pop").addEventListener("animationiteration", swap); }
  // cards tilt toward the pointer + shine (desktop only)
  if (matchMedia("(hover:hover)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
    document.addEventListener("pointermove", e => {
      const c = e.target.closest && e.target.closest(".card.in-view"); document.querySelectorAll(".card.tilt").forEach(x => { if (x !== c) { x.classList.remove("tilt"); x.style.transform = ""; } });
      if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.classList.add("tilt"); c.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`; c.style.setProperty("--sx", (x + .5) * 100 + "%"); c.style.setProperty("--sy", (y + .5) * 100 + "%");
    }, { passive: true });
  }
  if (party.child) setTimeout(() => burst(innerWidth * .7, innerHeight * .35, 60), 700);
})();
