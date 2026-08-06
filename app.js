(() => {
  "use strict";

  /* ============================================================
     0) Small DOM helpers
     ============================================================ */
  const $ = (id) => document.getElementById(id);

  const els = {
    themeToggle: $("themeToggle"),
    modeTashkeelBtn: $("modeTashkeelBtn"),
    modeSpellBtn: $("modeSpellBtn"),
    inputText: $("inputText"),
    inputCounter: $("inputCounter"),
    pasteBtn: $("pasteBtn"),
    clearBtn: $("clearBtn"),
    runBtn: $("runBtn"),
    runBtnLabel: $("runBtnLabel"),
    tashkeelOptions: $("tashkeelOptions"),
    hideEndingsToggle: $("hideEndingsToggle"),
    outputCard: $("outputCard"),
    outputLabel: $("outputLabel"),
    statusLine: $("statusLine"),
    resultBox: $("resultBox"),
    suggestPop: $("suggestPop"),
    suggestWord: $("suggestWord"),
    suggestChips: $("suggestChips"),
    suggestClose: $("suggestClose"),
    copyBtn: $("copyBtn"),
    downloadBtn: $("downloadBtn"),
    fontMinus: $("fontMinus"),
    fontPlus: $("fontPlus"),
    dictBanner: $("dictBanner"),
    dictBannerText: $("dictBannerText"),
  };

  /* ============================================================
     1) Theme
     ============================================================ */
  function initTheme() {
    const saved = localStorage.getItem("arabimo_theme");
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = saved || (prefersLight ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }
  els.themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("arabimo_theme", next);
  });
  initTheme();

  /* ============================================================
     2) Result font size
     ============================================================ */
  function initFontSize() {
    const saved = parseFloat(localStorage.getItem("arabimo_fs")) || 1.5;
    document.documentElement.style.setProperty("--result-fs", saved + "rem");
  }
  function bumpFontSize(delta) {
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--result-fs")) || 1.5;
    const next = Math.min(2.6, Math.max(1.0, cur + delta));
    document.documentElement.style.setProperty("--result-fs", next + "rem");
    localStorage.setItem("arabimo_fs", next);
  }
  els.fontPlus.addEventListener("click", () => bumpFontSize(0.15));
  els.fontMinus.addEventListener("click", () => bumpFontSize(-0.15));
  initFontSize();

  /* ============================================================
     3) Mode switching
     ============================================================ */
  let mode = "tashkeel"; // or "spell"

  function setMode(next) {
    mode = next;
    const isTashkeel = mode === "tashkeel";
    els.modeTashkeelBtn.classList.toggle("is-active", isTashkeel);
    els.modeSpellBtn.classList.toggle("is-active", !isTashkeel);
    els.modeTashkeelBtn.setAttribute("aria-selected", String(isTashkeel));
    els.modeSpellBtn.setAttribute("aria-selected", String(!isTashkeel));
    els.tashkeelOptions.style.display = isTashkeel ? "" : "none";
    els.runBtnLabel.textContent = isTashkeel ? "✨ شكّل النص" : "✓ صحّح الإملاء";
    els.outputLabel.textContent = isTashkeel ? "النص مشكّلاً" : "نتيجة التدقيق";
    hideSuggestPop();
    updateRunButtonAvailability();
  }
  els.modeTashkeelBtn.addEventListener("click", () => setMode("tashkeel"));
  els.modeSpellBtn.addEventListener("click", () => setMode("spell"));

  /* ============================================================
     4) Data loading: tashkeel dictionary + hunspell dic/aff
     ============================================================ */
  const state = {
    tashkeelDict: null,
    tashkeelReady: false,
    spell: null,
    spellReady: false,
  };

  function updateDictBanner() {
    if (state.tashkeelReady && state.spellReady) {
      els.dictBanner.classList.add("is-ready");
    } else {
      const parts = [];
      if (!state.tashkeelReady) parts.push("قاموس التشكيل");
      if (!state.spellReady) parts.push("قاموس التدقيق الإملائي");
      els.dictBannerText.textContent = `جاري تحميل ${parts.join(" و ")} على جهازك… (مرّة واحدة فقط)`;
    }
  }

  function updateRunButtonAvailability() {
    const ready = mode === "tashkeel" ? state.tashkeelReady : state.spellReady;
    els.runBtn.disabled = !ready;
    els.runBtn.style.opacity = ready ? "1" : ".6";
  }

  async function loadTashkeelDict() {
    try {
      const res = await fetch("tashkeel.json");
      state.tashkeelDict = await res.json();
      state.tashkeelReady = true;
    } catch (e) {
      console.error("تعذّر تحميل قاموس التشكيل", e);
      els.dictBannerText.textContent = "تعذّر تحميل قاموس التشكيل. تحقّق من الاتصال ثم أعد تحميل الصفحة.";
    }
    updateDictBanner();
    updateRunButtonAvailability();
  }

  async function loadSpellChecker() {
    try {
      const [affRes, dicRes] = await Promise.all([fetch("ar.aff"), fetch("ar.dic")]);
      const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
      state.spell = NSpellFactory({ aff, dic });
      state.spellReady = true;
    } catch (e) {
      console.error("تعذّر تحميل قاموس التدقيق", e);
    }
    updateDictBanner();
    updateRunButtonAvailability();
  }

  loadTashkeelDict();
  loadSpellChecker();

  /* ============================================================
     5) Arabic text utilities
     ============================================================ */
  const DIACRITIC_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  const WORD_SPLIT_RE = /([\u0621-\u065F\u0670\u0671\u06D6-\u06ED]+)/g;
  const IRAB_MARKS = new Set(["\u064B", "\u064C", "\u064D", "\u064E", "\u064F", "\u0650"]);

  function stripDiacritics(s) {
    return s.replace(DIACRITIC_RE, "");
  }

  function tokenize(text) {
    // Alternating [separator, word, separator, word, ..., separator]
    return text.split(WORD_SPLIT_RE);
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isArabicToken(tok, index) {
    // odd indices from split() with a capturing group are the matches (Arabic runs)
    return index % 2 === 1;
  }

  /* ============================================================
     6) Tashkeel engine
     ============================================================ */
  function stripFinalIrab(word) {
    if (word.length && IRAB_MARKS.has(word[word.length - 1])) {
      return word.slice(0, -1);
    }
    return word;
  }

  // Diacritized forms of common attached clitics, used as a fallback
  // when the whole word isn't in the dictionary but word-minus-prefix is.
  // Ordered longest-first so compound prefixes match before single letters.
  // `definite: true` marks prefixes that include the "ال" article — a
  // definite noun can't carry tanwin, so we fold tanwin down to its
  // plain-vowel counterpart before attaching (السَّلَامُ not السَّلَامٌ).
  const PREFIX_DIACRITICS = [
    ["وبال", "وَبِالْ", true], ["فبال", "فَبِالْ", true], ["كبال", "كَبِالْ", true],
    ["بال", "بِالْ", true], ["كال", "كَالْ", true], ["فال", "فَالْ", true], ["وال", "وَالْ", true],
    ["ولل", "وَلِلْ", true], ["فلل", "فَلِلْ", true], ["لل", "لِلْ", true],
    ["ال", "الْ", true],
    ["و", "وَ", false], ["ف", "فَ", false], ["ب", "بِ", false],
    ["ك", "كَ", false], ["ل", "لِ", false], ["س", "سَ", false],
  ];
  const TANWIN_TO_PLAIN = { "\u064B": "\u064E", "\u064C": "\u064F", "\u064D": "\u0650" };

  function foldTanwin(word) {
    if (!word) return word;
    const last = word[word.length - 1];
    if (TANWIN_TO_PLAIN[last]) return word.slice(0, -1) + TANWIN_TO_PLAIN[last];
    return word;
  }

  function lookupTashkeel(bare) {
    const direct = state.tashkeelDict[bare];
    if (direct) return direct;
    for (const [prefix, diacPrefix, definite] of PREFIX_DIACRITICS) {
      if (bare.startsWith(prefix) && bare.length - prefix.length >= 2) {
        const rest = bare.slice(prefix.length);
        let restDiac = state.tashkeelDict[rest];
        if (restDiac) {
          if (definite) restDiac = foldTanwin(restDiac);
          return diacPrefix + restDiac;
        }
      }
    }
    return null;
  }

  function renderTashkeelSpan(diacritized) {
    let out = "";
    for (const ch of diacritized) {
      if (DIACRITIC_RE.test(ch)) {
        out += `<span class="tashkeel-mark">${ch}</span>`;
      } else {
        out += escapeHtml(ch);
      }
      DIACRITIC_RE.lastIndex = 0;
    }
    return out;
  }

  function runTashkeel() {
    const text = els.inputText.value;
    if (!text.trim()) return;
    const hideEndings = els.hideEndingsToggle.checked;
    const parts = tokenize(text);
    let found = 0;
    let total = 0;
    let html = "";

    parts.forEach((part, i) => {
      if (!part) return;
      if (!isArabicToken(part, i)) {
        html += escapeHtml(part);
        return;
      }
      const bare = stripDiacritics(part);
      if (!bare) { html += escapeHtml(part); return; }
      total++;
      let diac = lookupTashkeel(bare);
      if (diac) {
        found++;
        if (hideEndings) diac = stripFinalIrab(diac);
        html += renderTashkeelSpan(diac);
      } else {
        html += `<span class="tashkeel-unknown" title="لم يُعثر على تشكيل لهذه الكلمة في القاموس">${escapeHtml(part)}</span>`;
      }
    });

    els.resultBox.innerHTML = html;
    const pct = total ? Math.round((found / total) * 100) : 0;
    els.statusLine.innerHTML = total
      ? `تم تشكيل <span class="hi">${found}</span> من أصل ${total} كلمة (${pct}%). الكلمات غير الموجودة بالقاموس بقيت بلا تشكيل.`
      : "لم يتم العثور على كلمات عربية في النص.";
    els.outputCard.hidden = false;
  }

  /* ============================================================
     7) Spellcheck engine
     ============================================================ */
  const CLITIC_PREFIXES = ["وبال", "فبال", "كبال", "بال", "كال", "فال", "وال", "ولل", "فلل", "لل", "ال", "و", "ف", "ب", "ك", "ل", "س"];

  function isArabicWordValid(bare) {
    if (bare.length < 2) return true; // single letters: not worth flagging
    if (state.spell.correct(bare)) return true;
    for (const p of CLITIC_PREFIXES) {
      if (bare.startsWith(p) && bare.length - p.length >= 2) {
        if (state.spell.correct(bare.slice(p.length))) return true;
      }
    }
    return false;
  }

  let misspelledRegistry = []; // index -> {bare, suggestions}

  function runSpellcheck() {
    const text = els.inputText.value;
    if (!text.trim()) return;
    const parts = tokenize(text);
    misspelledRegistry = [];
    let wrong = 0;
    let total = 0;
    let html = "";

    parts.forEach((part, i) => {
      if (!part) return;
      if (!isArabicToken(part, i)) {
        html += escapeHtml(part);
        return;
      }
      const bare = stripDiacritics(part);
      if (!bare) { html += escapeHtml(part); return; }
      total++;
      if (isArabicWordValid(bare)) {
        html += escapeHtml(part);
      } else {
        wrong++;
        let suggestions = [];
        try { suggestions = state.spell.suggest(bare).slice(0, 5); } catch (e) { /* noop */ }
        const idx = misspelledRegistry.length;
        misspelledRegistry.push({ bare, suggestions });
        html += `<span class="misspelled" data-idx="${idx}">${escapeHtml(part)}</span>`;
      }
    });

    els.resultBox.innerHTML = html;
    els.statusLine.innerHTML = total
      ? (wrong
          ? `عُثر على <span class="hi">${wrong}</span> كلمة قد تحتوي على خطأ إملائي من أصل ${total}. اضغط على الكلمة لعرض اقتراحات.`
          : `لم يتم العثور على أي أخطاء إملائية واضحة من أصل ${total} كلمة 🎉`)
      : "لم يتم العثور على كلمات عربية في النص.";
    els.outputCard.hidden = false;
    hideSuggestPop();
  }

  /* ---- suggestion popover ---- */
  function showSuggestPop(span) {
    const idx = Number(span.dataset.idx);
    const entry = misspelledRegistry[idx];
    if (!entry) return;
    document.querySelectorAll(".misspelled.is-open").forEach((s) => s.classList.remove("is-open"));
    span.classList.add("is-open");
    els.suggestWord.textContent = span.textContent;
    els.suggestChips.innerHTML = "";
    if (entry.suggestions.length === 0) {
      const p = document.createElement("span");
      p.className = "card-label";
      p.textContent = "لا توجد اقتراحات";
      els.suggestChips.appendChild(p);
    } else {
      entry.suggestions.forEach((sugg) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = sugg;
        chip.addEventListener("click", () => {
          span.textContent = sugg;
          span.classList.remove("misspelled", "is-open");
          hideSuggestPop();
        });
        els.suggestChips.appendChild(chip);
      });
    }
    els.suggestPop.hidden = false;
    els.suggestPop.dataset.forIdx = String(idx);
  }
  function hideSuggestPop() {
    els.suggestPop.hidden = true;
    document.querySelectorAll(".misspelled.is-open").forEach((s) => s.classList.remove("is-open"));
  }
  els.suggestClose.addEventListener("click", hideSuggestPop);

  els.resultBox.addEventListener("click", (e) => {
    const span = e.target.closest(".misspelled");
    if (span) showSuggestPop(span);
  });

  /* ============================================================
     8) Run button
     ============================================================ */
  els.runBtn.addEventListener("click", () => {
    if (mode === "tashkeel") runTashkeel();
    else runSpellcheck();
  });

  /* ============================================================
     9) Input helpers: counter, paste, clear
     ============================================================ */
  function updateCounter() {
    const text = els.inputText.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    els.inputCounter.textContent = `${words.toLocaleString("ar-EG")} كلمة`;
  }
  els.inputText.addEventListener("input", updateCounter);
  updateCounter();

  els.pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      els.inputText.value += (els.inputText.value ? "\n" : "") + text;
      updateCounter();
      els.inputText.focus();
    } catch (e) {
      els.inputText.focus();
    }
  });

  els.clearBtn.addEventListener("click", () => {
    els.inputText.value = "";
    updateCounter();
    els.resultBox.innerHTML = "";
    els.statusLine.textContent = "";
    els.outputCard.hidden = true;
    hideSuggestPop();
    els.inputText.focus();
  });

  /* ============================================================
     10) Output actions: copy, download
     ============================================================ */
  els.copyBtn.addEventListener("click", async () => {
    const text = els.resultBox.innerText;
    try {
      await navigator.clipboard.writeText(text);
      const original = els.copyBtn.textContent;
      els.copyBtn.textContent = "تم النسخ ✓";
      setTimeout(() => (els.copyBtn.textContent = original), 1400);
    } catch (e) {
      alert("تعذّر النسخ التلقائي، الرجاء التحديد اليدوي.");
    }
  });

  els.downloadBtn.addEventListener("click", () => {
    const text = els.resultBox.innerText;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "عربي-مو.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ============================================================
     11) Service worker (offline support)
     ============================================================ */
  if (navigator.serviceWorker && typeof navigator.serviceWorker.register === "function") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* init */
  setMode("tashkeel");
  updateDictBanner();
})();
