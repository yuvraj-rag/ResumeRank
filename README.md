# RankResume

A lightweight system to rank resumes against job descriptions using deterministic NLP scoring — combining vector semantic similarity, weighted keyword coverage, and skill experience estimation. Made using basic ML techniques, no AI or LLMs involved.

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

### Prerequisites
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
  "ranking_run_id": "9cf7f857-ec57-4142-9c9f-5f89066d477d",
  "jd_filename": "senior_backend_jd.txt",
  "total_resumes_processed": 1,
  "rankings": [
    {
      "rank": 1,
      "cv": "alex_morgan.pdf",
      "score": 0.8654,
      "semantic_score": 0.8821,
      "keyword_coverage": 0.8345,
      "matched": ["python", "fastapi", "postgresql", "docker"],
      "missing": ["kubernetes"],
      "experience_score": 0.8000,
      "experience": {
        "python": { "years": 5.0, "method": "explicit_window" },
        "docker": { "years": 3.0, "method": "job_block_inference" }
      }
    }
  ],
  "file_errors": {}
}
```

### History Endpoints (Authenticated)
When signed in, ranking runs and original files are optionally saved to history:
- `GET /history`: List saved ranking runs.
- `GET /history/{run_id}`: Retrieve detailed results for a run.
- `DELETE /history/{run_id}`: Delete a saved run and associated files.
- `GET /history/{run_id}/files/{filename}`: Generate a signed download URL for original uploaded files.

---

## Project Structure

```
RankResume/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── routes.py          # API endpoints (/rank, /health, /history)
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── pipeline.py        # Core ranking orchestration
│   │   ├── auth.py            # JWT authentication
│   │   ├── persistence.py     # Database & storage persistence
│   │   └── supabase_client.py # Client initialization
│   ├── src/
│   │   ├── extraction.py      # Text extraction (PDF, DOCX, TXT)
│   │   ├── preprocessing.py   # Noise cleaning & lemmatization
│   │   ├── representation.py  # TF-IDF & spaCy vector embeddings
│   │   ├── scoring.py         # Cosine similarity & keyword matching
│   │   ├── experience.py      # Timeline & duration extraction
│   │   ├── synonyms.py        # Technical abbreviation expansion
│   │   └── negation.py        # Negation detection window
│   ├── config.py              # Central application settings & defaults
│   ├── .env.example           # Environment template
│   └── requirements.txt
│
└── frontend/                  # Next.js web application
    ├── src/
    │   ├── app/               # Layout & pages
    │   ├── components/        # UI components & upload dropzones
    │   ├── hooks/             # Authentication hooks
    │   └── lib/               # API client & helpers
    └── package.json
```

---

## Configuration

Standard application defaults are defined in `backend/config.py`. Private secrets and environment-specific endpoints can be set in `backend/.env.local`:

| Variable | Source | Description |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `.env.local` | Supabase project URL (optional, for history & auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Supabase service-role secret key |
| `CORS_ORIGINS` | `.env.local` | Allowed origins (e.g., `http://localhost:3000`) |
| `SEMANTIC_WEIGHT` | `config.py` | Weight for semantic cosine similarity (`0.65`) |
| `KEYWORD_WEIGHT` | `config.py` | Weight for keyword coverage (`0.35`) |
| `EXPERIENCE_WEIGHT` | `config.py` | Weight for experience blend when enabled (`0.20`) |
| `EXPERIENCE_YEARS_CAP` | `config.py` | Max years for 100% skill tenure credit (`5.0`) |
| `MAX_FILE_SIZE_MB` | `config.py` | Max file size in MB (`10`) |
| `MAX_CV_COUNT` | `config.py` | Max CVs per batch request (`20`) |

---

## Running Tests

To run the backend test suite:
```bash
cd backend
pytest
```