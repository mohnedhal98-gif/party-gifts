// Shared helpers for the guest page and the invitation tool
const GX = {
  WORLDS: [
    { id: "Build It", e: "🧱", c: "#FFC700" },
    { id: "RC & Speed", e: "🏎️", c: "#FF8A3D" },
    { id: "Tracks & Trains", e: "🚂", c: "#38B6FF" },
    { id: "Pretend Play", e: "🍳", c: "#FF4F8B" },
    { id: "Cuddly & Dolls", e: "🧸", c: "#F9A8D4" },
    { id: "Arts & DIY", e: "🎨", c: "#8B5CF6" },
    { id: "Beach & Water", e: "🏖️", c: "#5EEAD4" },
    { id: "Blasters & Sports", e: "🎯", c: "#2BD67B" },
    { id: "Baby & Ride-On", e: "🍼", c: "#FDE68A" },
    { id: "Gifts & Decor", e: "✨", c: "#C4B5FD" },
    { id: "Fun Toys", e: "🎁", c: "#FCA5A5" }
  ],
  async load() {
    const bust = "?v=" + Math.floor(Date.now() / 6e5);
    const [config, products, stock] = await Promise.all([
      fetch("data/config.json" + bust).then(r => r.json()),
      fetch("data/products.json" + bust).then(r => r.json()),
      fetch("data/stock.json" + bust).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    return { config, products: products.filter(p => p.active !== false), stock: stock || { venues: {} } };
  },
  world(id) { return GX.WORLDS.find(w => w.id === id) || GX.WORLDS[GX.WORLDS.length - 1]; },
  money(n, cur) { return (cur || "QAR") + " " + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); },
  age(p, y) { y = y || "yrs"; return p.ageMax >= 99 ? p.ageMin + "+ " + y : p.ageMin + "–" + p.ageMax + " " + y; },
  niceDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  },
  esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
  photo(p) {
    const e = p.emoji || GX.world(p.world).e;
    return p.image
      ? `<img src="${GX.esc(p.image)}" alt="${GX.esc(p.name)}" loading="lazy" onerror="this.outerHTML='<span class=emo>${e}</span>'">`
      : `<span class="emo">${e}</span>`;
  }
};

// ---------- barcodes as SVG (EAN-13, Code 128 fallback) ----------
GX.barcode = (function () {
  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
  const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  const PAR = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  const eanOk = s => /^\d{13}$/.test(s) && (10 - [...s.slice(0, 12)].reduce((a, d, i) => a + d * (i % 2 ? 3 : 1), 0) % 10) % 10 === +s[12];
  function ean(s) {
    const p = PAR[s[0]]; let bits = "101";
    for (let i = 1; i <= 6; i++) bits += (p[i - 1] === "L" ? L : G)[s[i]];
    bits += "01010";
    for (let i = 7; i <= 12; i++) bits += R[s[i]];
    return bits + "101";
  }
  const C128 = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
  function c128(s) {
    let codes;
    if (/^\d{4,}$/.test(s)) { // numeric: Code C pairs (shorter, easier to scan)
      const odd = s.length % 2, rest = odd ? s.slice(1) : s;
      codes = odd ? [104, s.charCodeAt(0) - 32, 99] : [105];
      for (let i = 0; i < rest.length; i += 2) codes.push(+rest.slice(i, i + 2));
    } else codes = [104, ...[...s].map(c => c.charCodeAt(0) - 32)];
    codes.push(codes.reduce((a, c, i) => a + c * (i || 1), 0) % 103, 106);
    let bits = "";
    codes.forEach(c => [...C128[c]].forEach((w, i) => bits += (i % 2 ? "0" : "1").repeat(+w)));
    return bits;
  }
  return function (code, h) {
    code = String(code || "").trim(); if (!code) return "";
    h = h || 64;
    const bits = eanOk(code) ? ean(code) : c128(code), q = 10, W = bits.length + q * 2;
    let rects = "", x = 0;
    while (x < bits.length) { if (bits[x] === "1") { let w = 1; while (bits[x + w] === "1") w++; rects += `<rect x="${x + q}" y="0" width="${w}" height="${h}"/>`; x += w; } else x++; }
    return `<svg class="bc" viewBox="0 0 ${W} ${h + 14}" preserveAspectRatio="none" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Barcode ${code}"><rect width="${W}" height="${h + 14}" fill="#fff"/><g fill="#000">${rects}</g><text x="${W / 2}" y="${h + 12}" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">${code}</text></svg>`;
  };
})();

// ---------- party themes (chosen by staff on the invitation tool) ----------
GX.THEMES = {
  party:    { en: "Party fun",    ar: "حفلة مرحة",     e: "🎉", art: "🧸", bg: "#FFC700", ac: "#FF4F8B", b: ["#FF4F8B", "#38B6FF", "#ffffff", "#2BD67B", "#8B5CF6"], paper: "confetti", rx: null },
  space:    { en: "Space",        ar: "الفضاء",        e: "🚀", art: "🚀", bg: "#A9BCFF", ac: "#8B5CF6", b: ["#1B1530", "#FFC700", "#ffffff", "#8B5CF6", "#38B6FF"], paper: "space", rx: /space|rocket|astronaut|shuttle|robot|cosmos|galaxy|moon/i },
  princess: { en: "Princess",     ar: "الأميرات",      e: "👑", art: "👑", bg: "#FFC6DF", ac: "#FF4F8B", b: ["#FF4F8B", "#ffffff", "#C4B5FD", "#FFC700", "#F9A8D4"], paper: "unicorn", rx: /princess|castle|doll|unicorn|flower|fairy|nanci|pink|bracelet|necklace|hair/i },
  dino:     { en: "Dinosaurs",    ar: "الديناصورات",   e: "🦖", art: "🦖", bg: "#A6EB8F", ac: "#FF8A3D", b: ["#2BD67B", "#FFC700", "#FF8A3D", "#ffffff", "#1B1530"], paper: "dinos", rx: /dino|volcano|dragon/i },
  heroes:   { en: "Super heroes", ar: "الأبطال",       e: "🦸", art: "🦸", bg: "#FF9F5A", ac: "#38B6FF", b: ["#38B6FF", "#FF4F8B", "#FFC700", "#ffffff", "#1B1530"], paper: "stars", rx: /police|fire|rescue|blaster|robot|rc |drift|monster|racing|special/i },
  ocean:    { en: "Under the sea", ar: "تحت البحر",   e: "🐳", art: "🐳", bg: "#8DE8F2", ac: "#38B6FF", b: ["#38B6FF", "#ffffff", "#2BD67B", "#FFC700", "#8B5CF6"], paper: "stars", rx: /beach|sand|water|bath|duck|marine|fish|ocean|mermaid/i },
  sweets:   { en: "Sweet treats", ar: "الحلويات",      e: "🍭", art: "🧁", bg: "#FFD9B0", ac: "#FF4F8B", b: ["#FF4F8B", "#ffffff", "#FFC700", "#C4B5FD", "#2BD67B"], paper: "hearts", rx: /dessert|cake|ice cream|kitchen|clay|candy|tea|coffee|shop/i }
};

// ---------- English / Arabic ----------
GX.I18N = {
  en: {
    giftFinder: "Gift finder", giftBag: "Gift bag", myList: "My list", lang: "عربي",
    kicker: "🎉 Birthday Gift Menu", invited: "💌 You're invited!",
    title: "Pick a gift.<br>We <span class=nm>wrap</span> it.", titleFor: "Pick a gift for <span class=nm>{c}</span>!",
    lead: "Pick your gifts, show your gift list at the toy shop and pay there. Free gift wrap and name card.",
    leadFor: "Choose a toy {c} will love. Show your gift list at the toy shop, pay there, and we wrap it for free with your name card.",
    seeAll: "🎁 See all gifts", helpChoose: "🔮 Help me choose", surprise: "🎲 Surprise me",
    partyIn: "⏳ Party in", days: "days", hours: "hours", mins: "mins", secs: "secs", partyDay: "🥳 It's party day!",
    s1: "Pick a gift", s1t: "Toys in stock at your venue", s2: "Design the wrap", s2t: "Paper, ribbon and name card", s3: "Show your gift list", s3t: "The shop scans it, wraps it, done",
    wishlist: "wishlist", wishSub: "Toys the birthday star really wants", themeTitle: "Perfect for the {t} party", themeSub: "Toys that match the party theme",
    notSure: "Not sure what to buy? 🔮", notSureT: "Answer 3 quick questions and we pick the perfect gifts. Or let the gift machine choose for you!",
    chooseWorld: "Choose a", world: "world", tapWorld: "Tap a world to explore", allToys: "All toys", toys: "toys",
    search: "Search toys, e.g. dinosaur, kitchen, car…", anyAge: "🎂 Any age", topPicks: "⭐ Top picks", low: "💰 Price: low to high", high: "💎 Price: high to low",
    anyBudget: "💸 Any budget", under: "Under", gifts: "gifts", gift: "gift", clear: "✕ Clear", noMatch: "😮 No toys match. Try another world or budget.",
    add: "+ Add", inBag: "✓ In bag", few: "Only {n} left", hostT: "Hosting the party? 🎈",
    hostP: "Make a return gift for every little guest. Pick one gift, tell us how many children, and we pack them all, ready for the end of the party.",
    howMany: "How many children?", pickReturn: "Pick a return gift →", addList: "🎈 Add to my gift list",
    footer: "Free gift wrap on every gift · Pay at the toy shop on the party day", stockAt: "Stock updated",
    bagEmpty: "Your gift bag is empty 🛍️", bagEmptyT: 'Tap "+ Add" on any toy', total: "Total", payShop: "Pay at the shop, nothing to pay now",
    nextWrap: "Next: design the wrap 🎀", paper: "Wrapping paper", ribbon: "Ribbon", cardMsg: "Name card message", cardPh: "Happy birthday! From Omar",
    nextList: "Next: my gift list 🎟️", place: "Party place", choosePlace: "Choose the party place", child: "Birthday child's name", childPh: "e.g. Sara",
    pdate: "Party date", yourName: "Your name (optional)", yourNamePh: "So the shop knows who it's from", makeList: "🎟️ Make my gift list",
    t1: "1 · Gifts", t2: "2 · Wrap", t3: "3 · Gift list", extras: "✨ Add a little extra", extrasT: "Small surprises under QAR 30",
    rule: "🎟️ Show your gift list at the toy shop. The team scans each barcode, takes your payment and wraps your gifts for free.",
    eGift: "Please add at least one gift.", ePlace: "Please choose the party place.", eChild: "Please write the birthday child's name.", eDate: "Please choose the party date.", ePast: "This party date has already passed.",
    listTitle: "🎟️ Gift list", birthday: "{c}'s birthday", from: "From", showShop: "👋 Show this screen at the toy shop. The team scans each barcode, you pay there, and they wrap your gifts for free.",
    wrap: "Wrap", card: "Name card", items: "items", item: "item", payAtShop: "pay at the shop", edit: "✏️ Edit gifts", done: "✓ Done", tip: "💡 Tip: take a screenshot so you have it ready at the shop.",
    added: "🎁 Added to your gift bag", removed: "Removed from bag", pickFirst: "👆 Pick a return gift first", returnAdded: "🎈 {n} return gifts added", maxStock: "Only {n} in stock at this venue",
    wherePrompt: "📍 Where is the party?", whereT: "Choose the venue to see the toys in stock there.",
    fAge: "How old is {c}? 🎂", fAgeStar: "the birthday star", fStep: "Step {n} of 3", fLove: "What do they love? 💭", fLoveT: "pick one or more", fBudget: "Your budget? 💰",
    fShow: "Show my gifts 🎁", next: "Next →", back: "← Back", again: "↺ Start again", perfect: "Perfect picks! 🎉", found: "We found {n} gifts that match.", noFound: "No exact match, try a different budget.", seeMatches: "See all {n} matches in the menu", finderPicks: "Gift finder picks",
    machine: "🎲 The gift machine", spinning: "Spinning…", addBag: "🎁 Add to bag", spinAgain: "🎲 Spin again", alsoLike: "You may also like", addOne: "➕ Add one more", freeWrapNote: "🎀 Free gift wrap and name card · 💛 Pay at the toy shop on the party day",
    sound: "Sound", years: "yrs", noBarcode: "No barcode, use Ref"
  },
  ar: {
    giftFinder: "مساعد الهدايا", giftBag: "حقيبة الهدايا", myList: "قائمتي", lang: "EN",
    kicker: "🎉 قائمة هدايا عيد الميلاد", invited: "💌 أنت مدعو!",
    title: "اختر هدية.<br>ونحن <span class=nm>نغلّفها</span>.", titleFor: "اختر هدية لـ <span class=nm>{c}</span>!",
    lead: "اختر هداياك، واعرض قائمتك في متجر الألعاب وادفع هناك. تغليف مجاني وبطاقة باسمك.",
    leadFor: "اختر لعبة سيحبها {c}. اعرض قائمة هداياك في متجر الألعاب وادفع هناك، ونغلّفها لك مجاناً مع بطاقة باسمك.",
    seeAll: "🎁 كل الهدايا", helpChoose: "🔮 ساعدني أختار", surprise: "🎲 فاجئني",
    partyIn: "⏳ الحفلة بعد", days: "يوم", hours: "ساعة", mins: "دقيقة", secs: "ثانية", partyDay: "🥳 اليوم يوم الحفلة!",
    s1: "اختر هدية", s1t: "ألعاب متوفرة في مكان الحفلة", s2: "صمّم التغليف", s2t: "الورق والشريط والبطاقة", s3: "اعرض قائمة هداياك", s3t: "المتجر يمسحها ويغلّفها وخلاص",
    wishlist: "أمنيات", wishSub: "ألعاب يتمناها صاحب الحفلة", themeTitle: "مثالية لحفلة {t}", themeSub: "ألعاب تناسب موضوع الحفلة",
    notSure: "محتار ماذا تشتري؟ 🔮", notSureT: "أجب عن 3 أسئلة سريعة ونختار لك أفضل الهدايا. أو دع آلة الهدايا تختار لك!",
    chooseWorld: "اختر", world: "عالماً", tapWorld: "اضغط على عالم لتستكشفه", allToys: "كل الألعاب", toys: "لعبة",
    search: "ابحث عن لعبة، مثل ديناصور، مطبخ، سيارة…", anyAge: "🎂 كل الأعمار", topPicks: "⭐ الأفضل", low: "💰 السعر: من الأقل", high: "💎 السعر: من الأعلى",
    anyBudget: "💸 أي ميزانية", under: "أقل من", gifts: "هدية", gift: "هدية", clear: "✕ مسح", noMatch: "😮 لا توجد ألعاب مطابقة. جرّب عالماً أو ميزانية أخرى.",
    add: "+ أضف", inBag: "✓ في الحقيبة", few: "باقي {n} فقط", hostT: "أنت صاحب الحفلة؟ 🎈",
    hostP: "جهّز هدية توزيعات لكل طفل. اختر هدية واحدة، وحدد عدد الأطفال، ونجهزها كلها لنهاية الحفلة.",
    howMany: "كم عدد الأطفال؟", pickReturn: "← اختر هدية التوزيعات", addList: "🎈 أضف إلى قائمتي",
    footer: "تغليف مجاني لكل هدية · الدفع في متجر الألعاب يوم الحفلة", stockAt: "آخر تحديث للمخزون",
    bagEmpty: "حقيبة الهدايا فارغة 🛍️", bagEmptyT: "اضغط \"+ أضف\" على أي لعبة", total: "المجموع", payShop: "الدفع في المتجر، لا شيء الآن",
    nextWrap: "التالي: صمّم التغليف 🎀", paper: "ورق التغليف", ribbon: "الشريط", cardMsg: "رسالة البطاقة", cardPh: "عيد ميلاد سعيد! من عمر",
    nextList: "التالي: قائمة هداياي 🎟️", place: "مكان الحفلة", choosePlace: "اختر مكان الحفلة", child: "اسم صاحب الحفلة", childPh: "مثلاً سارة",
    pdate: "تاريخ الحفلة", yourName: "اسمك (اختياري)", yourNamePh: "ليعرف المتجر الهدية من مين", makeList: "🎟️ جهّز قائمة هداياي",
    t1: "١ · الهدايا", t2: "٢ · التغليف", t3: "٣ · القائمة", extras: "✨ أضف لمسة صغيرة", extrasT: "مفاجآت صغيرة بأقل من 30 ريال",
    rule: "🎟️ اعرض قائمة هداياك في متجر الألعاب. الفريق يمسح كل باركود، تدفع هناك، ويغلّفون هداياك مجاناً.",
    eGift: "أضف هدية واحدة على الأقل.", ePlace: "اختر مكان الحفلة.", eChild: "اكتب اسم صاحب الحفلة.", eDate: "اختر تاريخ الحفلة.", ePast: "تاريخ الحفلة قد مضى.",
    listTitle: "🎟️ قائمة الهدايا", birthday: "عيد ميلاد {c}", from: "من", showShop: "👋 اعرض هذه الشاشة في متجر الألعاب. الفريق يمسح كل باركود، تدفع هناك، ويغلّفون هداياك مجاناً.",
    wrap: "التغليف", card: "البطاقة", items: "قطع", item: "قطعة", payAtShop: "الدفع في المتجر", edit: "✏️ تعديل الهدايا", done: "✓ تم", tip: "💡 نصيحة: خذ لقطة شاشة لتكون جاهزة في المتجر.",
    added: "🎁 أضيفت إلى حقيبة الهدايا", removed: "حُذفت من الحقيبة", pickFirst: "👆 اختر هدية التوزيعات أولاً", returnAdded: "🎈 أضيفت {n} هدية توزيعات", maxStock: "متوفر {n} فقط في هذا المكان",
    wherePrompt: "📍 أين الحفلة؟", whereT: "اختر المكان لترى الألعاب المتوفرة هناك.",
    fAge: "كم عمر {c}؟ 🎂", fAgeStar: "صاحب الحفلة", fStep: "الخطوة {n} من 3", fLove: "ماذا يحب؟ 💭", fLoveT: "اختر واحداً أو أكثر", fBudget: "ميزانيتك؟ 💰",
    fShow: "أرني الهدايا 🎁", next: "التالي ←", back: "→ رجوع", again: "↺ من جديد", perfect: "اختيارات رائعة! 🎉", found: "وجدنا {n} هدية مناسبة.", noFound: "لا يوجد تطابق، جرّب ميزانية أخرى.", seeMatches: "شاهد كل الـ {n} في القائمة", finderPicks: "اختيارات المساعد",
    machine: "🎲 آلة الهدايا", spinning: "تدور…", addBag: "🎁 أضف للحقيبة", spinAgain: "🎲 دوّر مرة ثانية", alsoLike: "قد يعجبك أيضاً", addOne: "➕ أضف واحدة أخرى", freeWrapNote: "🎀 تغليف وبطاقة مجاناً · 💛 الدفع في متجر الألعاب يوم الحفلة",
    sound: "الصوت", years: "سنة", noBarcode: "لا يوجد باركود، استخدم الرمز"
  }
};
GX.WORLD_AR = { "Build It": "البناء", "RC & Speed": "السرعة والتحكم", "Tracks & Trains": "المسارات والقطارات", "Pretend Play": "لعب الأدوار", "Cuddly & Dolls": "الدمى والمحشوات", "Arts & DIY": "الفنون والأشغال", "Beach & Water": "البحر والماء", "Blasters & Sports": "الرياضة والحركة", "Baby & Ride-On": "الرضع والدراجات", "Gifts & Decor": "هدايا وديكور", "Fun Toys": "ألعاب ممتعة" };
