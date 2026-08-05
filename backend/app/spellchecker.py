from symspellpy.symspellpy import SymSpell, Verbosity
import pkg_resources
import os
import io
import re
from difflib import get_close_matches

class SpellChecker:
    def __init__(self, max_edit_distance=2):
        # try to load prebuilt frequency dictionary if available
        self.symspell = None
        self.wordlist = None
        try:
            self.symspell = SymSpell(max_dictionary_edit_distance=max_edit_distance)
            word_freq_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'frequency_dictionary_ar.txt')
            if os.path.exists(word_freq_path):
                self.symspell.load_dictionary(word_freq_path,term_index=0,count_index=1)
        except Exception:
            self.symspell = None
        # fallback small wordlist
        wl_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'arabic_wordlist.txt')
        if os.path.exists(wl_path):
            with io.open(wl_path, 'r', encoding='utf-8') as f:
                self.wordlist = [l.strip() for l in f if l.strip()]
        else:
            # tiny fallback
            self.wordlist = ['السلام','عليكم','مرحبا','مثال','كتاب','عربي','لغة','تشكيل','تصحيح']
        self.ar_re = re.compile(r'[\u0600-\u06FF]+')

    def check(self, text: str) -> str:
        # naive approach: for each word, if not in wordlist, suggest closest
        tokens = re.split(r'(\s+)', text)
        out = []
        for t in tokens:
            if not t.strip():
                out.append(t)
                continue
            if self.ar_re.fullmatch(t):
                # pure Arabic token
                suggestion = self._suggest(t)
                out.append(suggestion)
            else:
                out.append(t)
        return ''.join(out)

    def _suggest(self, word: str) -> str:
        # first try symspell
        if self.symspell:
            suggestions = self.symspell.lookup(word, Verbosity.CLOSEST, max_edit_distance=2)
            if suggestions:
                return suggestions[0].term
        # fallback to close matches
        matches = get_close_matches(word, self.wordlist, n=1, cutoff=0.7)
        if matches:
            return matches[0]
        return word
