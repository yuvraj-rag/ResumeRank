# CV Ranking System

A simple tool to rank resumes based on how well they fit given job descriptions. Uses text processing — no AI models, no APIs.

## Overview

You give it resumes, you give it job descriptions, and it tells you which resumes are the best matches for each job. It assigns a score to each resume from 0 to 1.

## How It Works

The system scores each resume using two signals combined together:

- **Semantic Similarity** — Does the resume talk about similar topics and skills? Even if the exact wording is different, For example - "backend engineer" and "server-side developer" should match due to vector similarity.

- **Keyword Matching** — Does the resume mention the specific technical keywords from the job description? For example - If the job says "Python, Django, PostgreSQL," they are counted.

None of these signals alone is reliable enough to produce a meaningful ranking. Pure semantic similarity scores almost everyone the same. Pure keywords miss relevant experience that uses different terminology. Together, they work much better.

## Getting Started

### What You Need

- Python 3.7+
- pip (comes with Python)

### Installation

1. Get this project
2. Install the requirements:

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_md
```

The spaCy command downloads a language model (~45MB) that helps understand and tokenize English text.

## Usage

### Quick Start

1. Put resume files in `data/cvs/` (`.txt`, `.pdf`)
2. Put job descriptions in `data/job_descriptions/` (`.txt`)
3. Run:

```bash
python main.py
```

Done. Your rankings will appear in `results/`.

### Example

Input:

**`data/job_descriptions/python_engineer.txt`**
> "Seeking Python backend engineer. Must have Django, PostgreSQL, and REST API experience. Docker knowledge preferred."

**`data/cvs/resume_1.pdf`**
> "Python Developer. Built Django backends for 4 years. Strong with PostgreSQL and REST API design. Used Docker daily."

**`data/cvs/resume_2.pdf`** 
> "Fullstack developer. Python and JavaScript. Built web apps with Django and React. Some experience with databases."

Output:

**`results/scored/python_engineer.txt`**
```
Ranking for python_engineer.txt
===============================
1. resume_1.pdf - 0.89
   Matched: python, django, postgresql, rest api, docker
   Missing: none

2. resume_2.pdf - 0.61
   Matched: python, django
   Missing: postgresql, rest api, docker, backend
```

## Output Files

### `results/extracted/`
Raw text extracted from your cv files. Useful for checking that extraction worked correctly.

### `results/scored/<jobname>.txt`
Human-readable rankings. Shows rank, score, matched keywords, and missing keywords for each resume against that job.

### `results/result.json`
Complete output in JSON format.

## Folder Structure

```
.
├── main.py                    # Run this
├── README.md                  # Current file
├── requirements.txt           
│
├── data/
│   ├── cvs/                   # CV folder (.txt or .pdf)
│   └── job_descriptions/      # Job Descriptions folder (.txt)
|
├── docs/
│   ├── example-files/         # sample files
│   └── design.md           
|   └── example.md 
│
├── results/                   # Output
│   ├── extracted/
│   │   ├── cvs/
│   │   └── job_descriptions/
│   ├── scored/
│   └── result.json
│
└── src/
    ├── extraction.py          # Reads files
    ├── preprocessing.py       # Cleans text
    ├── representation.py      # Converts to vectors
    └── scoring.py             # Ranks resumes
```

## How the Ranking Works (Complete Pipeline)

### Step 1: Extraction
- Read `.txt` files
- Extract text from `.pdf` files
- Save raw text for reference

### Step 2: Preprocessing
- Remove noise (emails, URLs, phone numbers)
- Use spaCy to parse English
- Lowercase everything
- Convert words to base form ("working" → "work")

### Step 3: Vectorization
- Compute TF-IDF scores (which words matter most?)
- Look up word meanings in spaCy's pre-trained model
- Create one vector per document by averaging word vectors, weighted by importance
- Extract top keywords per job description (treats multi-word phrases like "machine learning" as single units)

### Step 4: Scoring
- **Semantic score** — cosine similarity between resume and job vectors (0–1)
- **Keyword score** — fraction of job keywords found in resume (0–1)
- Sort resumes by final score (highest first)

## Documentation

For detailed examples of CV-job matching with scores and explanations, see [docs/example.md](docs/example.md).

For technical design, scoring approach, limitations, and future improvements, see [docs/design.md](docs/design.md).

## Limitations

**Be aware of:**

- Can't understand negation yet ("not experienced in X" looks like you have experience)
- Treats all resume sections equally (doesn't know "skills" should matter more than "address")
- English-focused (works poorly with other languages)
- Can't understand job context (cannot tell if "VP of Sales" and "Sales Associate" are related)
- Scores are relative, not absolute

## Troubleshooting

**"No CVs available" or "No job descriptions available"**
- Check that files are in the right folders with correct extensions

**"Can't find en_core_web_md"**
```bash
python -m spacy download en_core_web_md
```

**Results seem inaccurate**
- Make sure job descriptions have enough detail (bare job titles don't work well)
- Check extracted text to see what was actually read from files