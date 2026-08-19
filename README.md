# RankResume

A lightweight system to rank resumes against job descriptions using deterministic NLP scoring — combining vector semantic similarity, weighted keyword coverage, and skill experience estimation.

---

## Overview

You give it a job description and a batch of candidate resumes (`.pdf`, `.docx`, `.txt`), and it scores and ranks each resume from 0 to 1 based on how well the candidate fits the requirements.

---

## How It Works

The ranking combines three signals:

1. **Semantic Similarity (65% default weight)**  
   Converts documents into word vectors using spaCy's pre-trained English model (`en_core_web_md`) and calculates cosine similarity. This captures matching concepts even when phrasing differs (e.g., *"backend engineer"* matches *"server-side developer"*).

2. **Weighted Keyword Coverage (35% default weight)**  
   Extracts top technical keywords from the job description using TF-IDF weighting. Includes:
   - **Synonym Expansion:** Recognizes common tech equivalents (e.g., `JS` ↔ `JavaScript`, `ML` ↔ `Machine Learning`, `Postgres` ↔ `PostgreSQL`).
   - **Negation Awareness:** Detects negative phrasing (e.g., *"not experienced with Docker"*) so they are not counted as positive matches.

3. **Skill Experience Extraction (Optional 20% blend)**  
   When enabled for specific skills (e.g., Python, React), it extracts estimated tenure using:
   - *Explicit duration phrases* (e.g., *"5+ years of Python"*).
   - *Dated job history blocks* in the work experience section.
   - Cross-validation between both methods (capped at 5 years for full credit).

---

## Getting Started

### What You Need
- Python 3.9+
- Node.js 18+ (optional, for the web UI)

---

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_md
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```
The API will run at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup (Optional Web UI)

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to use the web interface.

---

## API Endpoints

### `GET /health`
Returns service and spaCy model status.
```json
{
  "status": "ok",
  "spacy_model_loaded": true
}
```

### `POST /rank`
Accepts `multipart/form-data`:
- `job_description`: File (`.txt`, `.pdf`, `.docx`)
- `cvs`: Multiple resume files (up to 20 files, max 10 MB each)
- `extract_experience`: boolean (`true` / `false`)
- `required_skills`: comma-separated string (e.g., `"Python,React,SQL"`)
- `use_experience_in_score`: boolean (`true` / `false`)

**Example Response:**
```json
{
  "jd_filename": "senior_backend_jd.txt",
  "rankings": [
    {
      "cv": "alex_morgan.pdf",
      "score": 0.8654,
      "semantic_score": 0.8821,
      "keyword_coverage": 0.8345,
      "experience_score": 0.8000,
      "matched": ["python", "fastapi", "postgresql", "docker"],
      "missing": ["kubernetes"]
    }
  ],
  "experience": {
    "alex_morgan.pdf": {
      "python": { "years": 5.0, "method": "explicit_window" },
      "docker": { "years": 3.0, "method": "job_block_inference" }
    }
  },
  "file_errors": []
}
```

---

## Project Structure

```
RankResume/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── routes.py        # API endpoints (/rank, /health)
│   │   ├── schemas.py       # Pydantic models
│   │   └── pipeline.py      # Core ranking orchestration
│   ├── src/
│   │   ├── extraction.py     # Text extraction (PDF, DOCX, TXT)
│   │   ├── preprocessing.py  # Noise cleaning & lemmatization
│   │   ├── representation.py # TF-IDF & spaCy vector embeddings
│   │   ├── scoring.py        # Cosine similarity & keyword matching
│   │   ├── experience.py     # Timeline & duration extraction
│   │   ├── synonyms.py       # Technical abbreviation expansion
│   │   └── negation.py       # Negation detection window
│   ├── config.py            # Environment-overridable settings
│   └── requirements.txt
│
└── frontend/                # Next.js web application
    ├── src/
    │   ├── app/             # Layout & pages
    │   └── components/      # UI components & upload dropzones
    └── package.json
```

---

## Configuration

Settings can be customized via environment variables in `backend/config.py`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SEMANTIC_WEIGHT` | `0.65` | Weight for semantic cosine similarity |
| `KEYWORD_WEIGHT` | `0.35` | Weight for keyword coverage |
| `EXPERIENCE_WEIGHT` | `0.20` | Weight for experience blend (when enabled) |
| `EXPERIENCE_YEARS_CAP` | `5.0` | Max years for 100% skill tenure credit |
| `MAX_FILE_SIZE_MB` | `10` | Max file size in MB |
| `MAX_CV_COUNT` | `20` | Max CVs per batch request |

---

## Running Tests

To run the backend test suite:
```bash
cd backend
pytest
```