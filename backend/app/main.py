from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from .diacritizer import Diacritizer
from .spellchecker import SpellChecker

app = FastAPI(title="عربي — Diacritizer & Spellchecker")

model_name = os.environ.get("DIACRITIZER_MODEL")  # optional HF model name
D = Diacritizer(model_name=model_name)
S = SpellChecker()

class TextRequest(BaseModel):
    text: str
    mode: Optional[str] = "medium"  # light | medium | strong

@app.post('/api/diacritize')
async def diacritize(req: TextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="empty text")
    out = D.process(req.text, mode=req.mode)
    return {"text": out}

@app.post('/api/spellcheck')
async def spellcheck(req: TextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="empty text")
    out = S.check(req.text)
    return {"original": req.text, "corrected": out}
