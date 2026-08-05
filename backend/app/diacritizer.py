import os
import re
from typing import Optional

# Try to import transformers if available; optional for better accuracy
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    HF_AVAILABLE = True
except Exception:
    HF_AVAILABLE = False

class Diacritizer:
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name
        self.use_hf = False
        if model_name and HF_AVAILABLE:
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
                self.use_hf = True
            except Exception as e:
                # fallback to rule-based
                print("Failed to load HF model:", e)
                self.use_hf = False
        # simple Arabic letters pattern
        self.arabic_word_re = re.compile(r"[\u0600-\u06FF]+")

    def process(self, text: str, mode: str = 'medium') -> str:
        text = text.strip()
        if self.use_hf:
            return self._hf_diacritize(text)
        else:
            return self._rule_based_diacritize(text, mode)

    def _hf_diacritize(self, text: str) -> str:
        # chunking for long text
        inputs = self.tokenizer(text, return_tensors='pt', truncation=True)
        out_ids = self.model.generate(**inputs, max_new_tokens=512)
        out_text = self.tokenizer.batch_decode(out_ids, skip_special_tokens=True)[0]
        return out_text

    def _rule_based_diacritize(self, text: str, mode: str='medium') -> str:
        # Very lightweight rule-based diacritizer as a fallback.
        # This is intentionally conservative — it tries to add short vowels to common patterns.
        def diacritize_word(w: str) -> str:
            # preserve if already has tashkeel
            if any(ch in w for ch in '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652'):
                return w
            # heuristic: if ends with Alef Maqsura or Alef, assume fatha before it
            if re.search(r'[\u0627\u0649]$', w):
                return w + 'َ'
            # short words (<=2) leave unchanged
            if len(w) <= 2:
                return w
            # place a fatha on first letter and kasra on last letter as a conservative guess
            return w[0] + 'َ' + w[1:-1] + w[-1] + 'ِ'

        parts = re.split(r'(\s+)', text)
        out_parts = []
        for p in parts:
            if self.arabic_word_re.search(p):
                # diacritize each Arabic token
                tokens = re.split(r'([^\u0600-\u06FF]+)', p)
                rebuilt = []
                for t in tokens:
                    if self.arabic_word_re.fullmatch(t):
                        rebuilt.append(diacritize_word(t))
                    else:
                        rebuilt.append(t)
                out_parts.append(''.join(rebuilt))
            else:
                out_parts.append(p)
        return ''.join(out_parts)
