/* =========================================================
   عربي — منطق التطبيق
   - التشكيل: عبر مساحة Gradio عامة ومجانية على Hugging Face
   - التدقيق الإملائي: بالكامل داخل المتصفح (بدون خادم)
   ========================================================= */

/* ---------- عناصر الصفحة ---------- */
const $input          = document.getElementById("input-text");
const $charCount       = document.getElementById("char-count");
const $clearBtn         = document.getElementById("clear-btn");

const $tashkeelBtn      = document.getElementById("tashkeel-btn");
const $spellcheckBtn     = document.getElementById("spellcheck-btn");

const $segmentedOpts      = document.querySelectorAll(".segmented__opt");

const $tashkeelResult      = document.getElementById("tashkeel-result");
const $tashkeelStatus       = document.getElementById("tashkeel-status");
const $tashkeelOutput         = document.getElementById("tashkeel-output");
const $copyTashkeelBtn          = document.getElementById("copy-tashkeel-btn");

const $spellcheckResult           = document.getElementById("spellcheck-result");
const $spellcheckStatus            = document.getElementById("spellcheck-status");
const $spellcheckOutput              = document.getElementById("spellcheck-output");
const $spellcheckHint                 = document.getElementById("spellcheck-hint");
const $mistakeCount                    = document.getElementById("mistake-count");

let selectedMethod = "shakkala";

/* ---------- سلوكيات عامة ---------- */

$input.addEventListener("input", () => {
  $charCount.textContent = `${$input.value.length} حرف`;
});

$clearBtn.addEventListener("click", () => {
  $input.value = "";
  $charCount.textContent = "0 حرف";
  $input.focus();
});

$segmentedOpts.forEach((btn) => {
  btn.addEventListener("click", () => {
    $segmentedOpts.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-checked", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-checked", "true");
    selectedMethod = btn.dataset.method;
  });
});

function setStatus($el, message, kind) {
  if (!message) {
    $el.hidden = true;
    $el.innerHTML = "";
    return;
  }
  $el.hidden = false;
  $el.classList.toggle("is-error", kind === "error");
  const dot = kind === "error" ? "" : `<span class="status-line__dot"></span>`;
  $el.innerHTML = `${dot}<span>${message}</span>`;
}

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = original; }, 1200);
  } catch {
    // نسخ يدوي كخطة بديلة إن رفض المتصفح صلاحية الحافظة
    window.prompt("انسخ النص يدويًا:", text);
  }
}

/* =========================================================
   1) التشكيل التلقائي — عبر Gradio Space على Hugging Face
   ========================================================= */

const TASHKEEL_SPACE = "egyup/tashkeel";

let clientPromise = null;
let apiInfoPromise = null;

// نحمّل مكتبة عميل Gradio من CDN فقط عند أول استخدام فعلي (لا داعي لتحميلها مسبقًا)
async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client } = await import(
        "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js"
      );
      return Client.connect(TASHKEEL_SPACE, {
        status_callback: (s) => {
          if (s && (s.status === "sleeping" || s.status === "building" || s.status === "starting")) {
            setStatus($tashkeelStatus, "المساحة المجانية على Hugging Face تستيقظ الآن… قد يستغرق هذا حتى ٣٠ ثانية أول مرة.");
          }
        },
      });
    })();
  }
  return clientPromise;
}

// نكتشف اسم نقطة الوصول الحقيقية واسم المعامل المطلوب بدل افتراضهما يدويًا،
// حتى يستمر عمل الأداة إن غيّر صاحب المساحة تفاصيل داخلية بسيطة
async function resolveEndpoint(client, keyword, fallbackName) {
  if (!apiInfoPromise) {
    apiInfoPromise = client.view_api().catch(() => null);
  }
  const info = await apiInfoPromise;
  const endpoints = info?.named_endpoints || {};
  const names = Object.keys(endpoints);
  const found = names.find((n) => n.toLowerCase().includes(keyword)) || fallbackName;
  const params = endpoints[found]?.parameters;
  const paramName = params && params[0] ? params[0].parameter_name : "input_text";
  return { endpointName: found, paramName };
}

async function runTashkeel(text, method) {
  const client = await getClient();
  const fallback = method === "catt" ? "/infer_catt" : "/infer_shakkala";
  const { endpointName, paramName } = await resolveEndpoint(client, method, fallback);
  const result = await client.predict(endpointName, { [paramName]: text });
  const raw = result && result.data ? result.data[0] : null;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw.value === "string") return raw.value;
  throw new Error("empty-response");
}

$tashkeelBtn.addEventListener("click", async () => {
  const text = $input.value.trim();
  if (!text) {
    $input.focus();
    return;
  }

  $tashkeelResult.hidden = false;
  $tashkeelOutput.textContent = "";
  $tashkeelBtn.disabled = true;
  setStatus($tashkeelStatus, "جارٍ التشكيل…");
  $tashkeelResult.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const diacritized = await runTashkeel(text, selectedMethod);
    $tashkeelOutput.textContent = diacritized;
    setStatus($tashkeelStatus, "");
  } catch (err) {
    setStatus(
      $tashkeelStatus,
      "تعذّر الوصول إلى خدمة التشكيل الآن (قد تكون المساحة المجانية نائمة أو غير متاحة مؤقتًا). أعد المحاولة بعد قليل.",
      "error"
    );
  } finally {
    $tashkeelBtn.disabled = false;
  }
});

$copyTashkeelBtn.addEventListener("click", () => {
  if ($tashkeelOutput.textContent) copyToClipboard($tashkeelOutput.textContent, $copyTashkeelBtn);
});

/* =========================================================
   2) التدقيق الإملائي — بالكامل في المتصفح، بدون خادم
   ========================================================= */

// قائمة تردد كلمات عربية شائعة (٥٠ ألف كلمة، من مشروع FrequencyWords المفتوح)
const DICTIONARY_URL =
  "https://cdn.jsdelivr.net/gh/hermitdave/FrequencyWords@master/content/2016/ar/ar_50k.txt";

// الحركات والتطويل لا تُعدّ اختلافًا إملائيًا عند المقارنة
const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

function normalizeWord(word) {
  return word.replace(DIACRITICS_RE, "");
}

let dictionaryPromise = null;

// أخطاء الهمزة (أ/إ/آ/ا) هي الأشيع في الإملاء العربي، لذا نُجمّع أشكال الألف
// معًا عند تصنيف الكلمات حسب حرفها الأول حتى تظهر الاقتراحات الصحيحة
function firstLetterKey(ch) {
  return ch === "أ" || ch === "إ" || ch === "آ" ? "ا" : ch;
}

async function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      const res = await fetch(DICTIONARY_URL);
      if (!res.ok) throw new Error("dictionary-fetch-failed");
      const text = await res.text();
      const freq = new Map();
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const idx = line.lastIndexOf(" ");
        if (idx === -1) continue;
        const word = line.slice(0, idx);
        const count = parseInt(line.slice(idx + 1), 10) || 1;
        const norm = normalizeWord(word);
        if (!norm) continue;
        freq.set(norm, (freq.get(norm) || 0) + count);
      }
      // فهرسة حسب الحرف الأول (مع دمج أشكال الألف) لتسريع البحث عن الاقتراحات
      const byFirstLetter = new Map();
      for (const w of freq.keys()) {
        const key = firstLetterKey(w[0]);
        if (!byFirstLetter.has(key)) byFirstLetter.set(key, []);
        byFirstLetter.get(key).push(w);
      }
      return { freq, byFirstLetter };
    })();
  }
  return dictionaryPromise;
}

// مسافة داميرو-لفنشتاين (تحتسب أيضًا تبديل حرفين متجاورين، شائع في أخطاء الكتابة)
function editDistance(a, b) {
  const al = a.length, bl = b.length;
  const d = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

function suggestFor(word, dict, limit = 3) {
  const key = firstLetterKey(word[0]);
  const candidates = dict.byFirstLetter.get(key) || [];
  const scored = [];
  for (const c of candidates) {
    if (Math.abs(c.length - word.length) > 2) continue;
    const dist = editDistance(word, c);
    if (dist <= 2) scored.push({ word: c, dist, freq: dict.freq.get(c) || 0 });
  }
  scored.sort((a, b) => a.dist - b.dist || b.freq - a.freq);
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    if (seen.has(s.word)) continue;
    seen.add(s.word);
    out.push(s.word);
    if (out.length >= limit) break;
  }
  return out;
}

// يقسّم النص إلى: كلمات عربية قابلة للتدقيق + كل ما عداها (مسافات، ترقيم، أرقام…)
// (الأرقام مستبعدة عمدًا من نمط الكلمات حتى لا تُعامَل كأخطاء إملائية)
const ARABIC_RUN_RE = /[\u0621-\u064A]+/g;

function tokenize(text) {
  const tokens = [];
  let lastIndex = 0;
  let m;
  ARABIC_RUN_RE.lastIndex = 0;
  while ((m = ARABIC_RUN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, m.index) });
    }
    tokens.push({ type: "word", value: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

$spellcheckBtn.addEventListener("click", async () => {
  const text = $input.value;
  if (!text.trim()) {
    $input.focus();
    return;
  }

  $spellcheckResult.hidden = false;
  $spellcheckOutput.innerHTML = "";
  $mistakeCount.hidden = true;
  $spellcheckHint.hidden = true;
  $spellcheckBtn.disabled = true;
  setStatus($spellcheckStatus, "جارٍ تحميل قائمة الكلمات (أول مرة فقط)…");
  $spellcheckResult.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const dict = await loadDictionary();
    setStatus($spellcheckStatus, "");

    const tokens = tokenize(text);
    let mistakes = 0;
    let html = "";

    tokens.forEach((tok, i) => {
      if (tok.type === "text") {
        html += escapeHtml(tok.value);
        return;
      }
      const norm = normalizeWord(tok.value);
      const isKnown = norm.length <= 1 || dict.freq.has(norm);
      if (isKnown) {
        html += escapeHtml(tok.value);
      } else {
        mistakes++;
        html += `<span class="mistake-word" data-word="${escapeHtml(tok.value)}" data-norm="${escapeHtml(norm)}" data-idx="${i}">${escapeHtml(tok.value)}</span>`;
      }
    });

    $spellcheckOutput.innerHTML = html;
    $mistakeCount.hidden = false;
    if (mistakes === 0) {
      $mistakeCount.textContent = "لا أخطاء ظاهرة ✓";
      $mistakeCount.classList.add("is-clean");
    } else {
      $mistakeCount.textContent = `${mistakes} كلمة مشتبه بها`;
      $mistakeCount.classList.remove("is-clean");
      $spellcheckHint.hidden = false;
    }
  } catch (err) {
    setStatus(
      $spellcheckStatus,
      "تعذّر تحميل قائمة الكلمات. تأكد من اتصالك بالإنترنت وأعد المحاولة.",
      "error"
    );
  } finally {
    $spellcheckBtn.disabled = false;
  }
});

// النقر على كلمة مشتبه بها يفتح اقتراحات بديلة، والنقر على اقتراح يستبدلها في النص
$spellcheckOutput.addEventListener("click", async (e) => {
  const target = e.target.closest(".mistake-word");
  if (!target) return;

  // أغلق أي نافذة اقتراحات مفتوحة سابقًا
  const existingPop = $spellcheckOutput.querySelector(".suggest-pop");
  const wasOpenOnThis = target.classList.contains("is-open");
  if (existingPop) existingPop.remove();
  $spellcheckOutput.querySelectorAll(".mistake-word.is-open").forEach((el) => el.classList.remove("is-open"));
  if (wasOpenOnThis) return; // كانت مفتوحة على هذه الكلمة نفسها: فقط أغلقها

  target.classList.add("is-open");
  const dict = await loadDictionary();
  const suggestions = suggestFor(target.dataset.norm, dict);

  const pop = document.createElement("span");
  pop.className = "suggest-pop";
  if (suggestions.length === 0) {
    pop.innerHTML = `<span class="suggest-chip suggest-chip--empty">لا توجد اقتراحات</span>`;
  } else {
    suggestions.forEach((s) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggest-chip";
      chip.textContent = s;
      chip.addEventListener("click", () => {
        const span = document.createElement("span");
        span.textContent = s;
        target.replaceWith(span);
        pop.remove();
      });
      pop.appendChild(chip);
    });
  }
  const ignoreChip = document.createElement("button");
  ignoreChip.type = "button";
  ignoreChip.className = "suggest-chip suggest-chip--ignore";
  ignoreChip.textContent = "تجاهل";
  ignoreChip.addEventListener("click", () => {
    target.classList.remove("mistake-word", "is-open");
    pop.remove();
  });
  pop.appendChild(ignoreChip);

  target.insertAdjacentElement("afterend", pop);
});
