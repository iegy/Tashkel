/*
 * تشكيل مو — منطق التشغيل بالكامل داخل المتصفح (بدون أي سيرفر)
 * =================================================================
 * التشكيل: نموذج libtashkeel (BiLSTM صغير، ~4.6MB) بصيغة ONNX،
 *          يعمل عبر onnxruntime-web (WASM) — مصدر النموذج:
 *          https://github.com/mush42/libtashkeel
 *
 * التصحيح الإملائي: nspell (منفذ Hunspell بجافاسكريبت خالص) +
 *          قاموس AyaSpell العربي — يعمل بالكامل محليًا بدون شبكة.
 */

// ---------------------------------------------------------------------
// إعداد onnxruntime-web: تشغيل بخيط واحد (numThreads=1) عشان يشتغل
// على أي استضافة ثابتة عادية من غير الحاجة لهيدرز COOP/COEP خاصة
// ---------------------------------------------------------------------
ort.env.wasm.wasmPaths = "./";
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

// ---------------------------------------------------------------------
// ثوابت مطابقة تمامًا لمنطق libtashkeel الأصلي (Rust)
// ---------------------------------------------------------------------
const ARABIC_DIACRITICS = new Set(
  ["\u0652", "\u0651", "\u064e", "\u064f", "\u0650", "\u064b", "\u064c", "\u064d"]
);
const NUMERALS = new Set("0123456789٠١٢٣٤٥٦٧٨٩".split(""));
const NUMERAL_SYMBOL = "#";
const PAD = "_";
// كل زوج هنا مطابق تمامًا (نفس نقاط الترميز) — موجود عشان يطابق سلوك المكتبة الأصلية بالحرف
const NORMALIZED_DIAC_MAP = {
  "\u064e\u0651": "\u064e\u0651",
  "\u064b\u0651": "\u064b\u0651",
  "\u064f\u0651": "\u064f\u0651",
  "\u064c\u0651": "\u064c\u0651",
  "\u0650\u0651": "\u0650\u0651",
  "\u064d\u0651": "\u064d\u0651",
};

let session = null;
let inputIdMap = null;
let targetIdMap = null; // id(number) -> diacritic string
let hintIdMap = null;

async function loadTashkeelAssets(onProgress) {
  onProgress?.("جاري تحميل خرائط الرموز…");
  const [inputMap, targetMapRaw, hintMap] = await Promise.all([
    fetch("./input_id_map.json").then((r) => r.json()),
    fetch("./target_id_map.json").then((r) => r.json()),
    fetch("./hint_id_map.json").then((r) => r.json()),
  ]);
  inputIdMap = inputMap;
  hintIdMap = hintMap;
  targetIdMap = {};
  for (const [k, v] of Object.entries(targetMapRaw)) targetIdMap[v] = k;

  onProgress?.("جاري تحميل نموذج التشكيل (~4.6MB)…");
  session = await ort.InferenceSession.create("./model.onnx", {
    executionProviders: ["wasm"],
  });
}

function toValidChars(text) {
  const valid = [];
  const removed = new Set();
  for (const c of text) {
    if (Object.prototype.hasOwnProperty.call(inputIdMap, c) || ARABIC_DIACRITICS.has(c)) {
      valid.push(c);
    } else if (NUMERALS.has(c)) {
      valid.push(NUMERAL_SYMBOL);
    } else {
      removed.add(c);
    }
  }
  return [valid.join(""), removed];
}

function extractCharsAndDiacritics(text) {
  // شيل أي حركات في أول النص
  let i = 0;
  while (i < text.length && ARABIC_DIACRITICS.has(text[i])) i++;
  text = text.slice(i);

  const clean = [];
  const diacritics = [];
  let pending = "";
  for (const c of text + " ") {
    if (ARABIC_DIACRITICS.has(c)) {
      pending += c;
    } else {
      clean.push(c);
      diacritics.push(pending);
      pending = "";
    }
  }
  clean.pop();
  diacritics.shift();

  for (let idx = 0; idx < diacritics.length; idx++) {
    const d = diacritics[idx];
    if (!Object.prototype.hasOwnProperty.call(hintIdMap, d)) {
      diacritics[idx] = NORMALIZED_DIAC_MAP[d] ?? "";
    }
  }
  return [clean.join(""), diacritics];
}

async function runTashkeelInference(text) {
  text = text.trim();
  if (!text) return "";

  const [validText, removedChars] = toValidChars(text);
  const [cleanText, diacritics] = extractCharsAndDiacritics(validText);

  const inputIds = Array.from(cleanText).map((c) => BigInt(inputIdMap[c]));
  const diacIds = diacritics.map((d) => BigInt(hintIdMap[d]));
  const seqLength = inputIds.length;

  if (seqLength === 0) return text;

  const charInputs = new ort.Tensor("int64", BigInt64Array.from(inputIds), [1, seqLength]);
  const diacInputs = new ort.Tensor("int64", BigInt64Array.from(diacIds), [1, seqLength]);
  const inputLengths = new ort.Tensor("int64", BigInt64Array.from([BigInt(seqLength)]), [1]);

  const outputs = await session.run({
    char_inputs: charInputs,
    diac_inputs: diacInputs,
    input_lengths: inputLengths,
  });

  const predictions = outputs.predictions.data; // Uint8Array بطول seqLength
  const padId = inputIdMap[PAD];

  const diacOut = [];
  for (const tid of predictions) {
    if (tid === padId) continue;
    diacOut.push(targetIdMap[tid] ?? "");
  }

  // إعادة بناء النص الأصلي مع الحركات الجديدة
  let out = "";
  let di = 0;
  for (const c of text) {
    if (ARABIC_DIACRITICS.has(c)) continue;
    if (removedChars.has(c)) {
      out += c;
    } else {
      out += c;
      out += diacOut[di] ?? "";
      di++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// التصحيح الإملائي عبر nspell (يعمل محليًا بالكامل)
// ---------------------------------------------------------------------
let spell = null;

async function loadSpellAssets(onProgress) {
  onProgress?.("جاري تحميل القاموس الإملائي (~7MB)…");
  const [aff, dic] = await Promise.all([
    fetch("./ar.aff").then((r) => r.text()),
    fetch("./ar.dic").then((r) => r.text()),
  ]);
  spell = window.nspell(aff, dic);
}

const ARABIC_WORD_RE = /[\u0621-\u064A]+/g;

function checkSpelling(text) {
  // بيرجع مصفوفة: [{word, index, suggestions}] للكلمات الغلط بس
  const issues = [];
  let match;
  ARABIC_WORD_RE.lastIndex = 0;
  while ((match = ARABIC_WORD_RE.exec(text)) !== null) {
    const word = match[0];
    if (!spell.correct(word)) {
      const suggestions = spell.suggest(word).slice(0, 5);
      issues.push({ word, index: match.index, suggestions });
    }
  }
  return issues;
}

window.TashkeelMo = {
  loadTashkeelAssets,
  loadSpellAssets,
  runTashkeelInference,
  checkSpelling,
};
