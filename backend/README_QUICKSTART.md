# Quickstart (development)

Prerequisites:
- Python 3.11+
- (optional) Docker

Local backend (recommended virtualenv):

1. cd backend
2. python -m venv .venv
3. source .venv/bin/activate
4. pip install -r requirements.txt
5. export DIACRITIZER_MODEL=""  # optional: set to a Hugging Face model name for high-quality diacritization
6. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Open frontend/index.html in the browser. The frontend expects backend at same origin. For development you can serve frontend via a simple HTTP server:

python -m http.server 3000 --directory frontend

Then open http://localhost:3000/index.html and set the backend base URL in the frontend script if needed.

Using Docker:
1. docker build -t tashkel-backend .
2. docker run -p 8000:8000 -e DIACRITIZER_MODEL="" tashkel-backend

Improving accuracy (recommended):
- Obtain or fine-tune a seq2seq diacritization model on Tashkeela/Tashkeel datasets and set DIACRITIZER_MODEL to the HF repo id.
- Populate backend/data/frequency_dictionary_ar.txt with a large frequency list to improve spellchecking.

Training/fine-tuning notes:
- Use Hugging Face Transformers `seq2seq` modeling. Prepare dataset of (plain -> diacritized) pairs.
- Fine-tune using `Trainer` with appropriate tokenizer/model.

