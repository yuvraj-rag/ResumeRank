import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from config import settings


def _to_tfidf_text(doc):
    # rare domain words like don't have spaCy vectors but we
    # still want TF-IDF to see them, so no has_vector filter here
    return " ".join(
        token.lemma_
        for token in doc
        if not token.is_stop and not token.is_punct and len(token.lemma_) > 2
    )


def get_document_vectors(docs, all_docs):
    all_names = list(all_docs.keys())
    all_texts = [_to_tfidf_text(all_docs[n]) for n in all_names]

    dim = next(iter(all_docs.values())).vocab.vectors_length

    if all(t.strip() == "" for t in all_texts):
        return {name: np.zeros(dim) for name in docs}

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(all_texts)
    vocab = vectorizer.vocabulary_
    name_to_idx = {n: i for i, n in enumerate(all_names)}

    vectors = {}
    for name, doc in docs.items():
        tfidf_row = tfidf_matrix[name_to_idx[name]].toarray()[0]

        weighted_sum = np.zeros(dim)
        total_weight = 0.0

        for token in doc:
            if token.is_stop or token.is_punct or not token.has_vector:
                continue
            weight = tfidf_row[vocab[token.lemma_]] if token.lemma_ in vocab else 0.0
            if weight > 0:
                weighted_sum += token.vector * weight
                total_weight += weight

        vectors[name] = weighted_sum / total_weight if total_weight > 0 else np.zeros(dim)

    return vectors


def get_top_keywords(jds, cvs, top_n=None):
    """
    Returns {jd_name: [(keyword, weight), ...]}, in descending order of
    importance.

    weight is the keyword's own TF-IDF score in the JD-vs-CVs corpus when
    settings.KEYWORD_WEIGHTING_ENABLED is True — this lets scoring.py
    reward a match on a highly job-specific keyword more than a match on
    an incidental one. When disabled, every keyword gets weight 1.0,
    exactly reproducing the original "every keyword counts equally"
    behaviour.

    top_n defaults to settings.TOP_N_KEYWORDS when not explicitly
    overridden.
    """
    if top_n is None:
        top_n = settings.TOP_N_KEYWORDS

    cv_texts = [_to_tfidf_text(doc) for doc in cvs.values()]

    keywords = {}
    for jd_name, jd_doc in jds.items():
        jd_text = _to_tfidf_text(jd_doc)
        corpus = [jd_text] + cv_texts

        if not any(t.strip() for t in corpus):
            keywords[jd_name] = []
            continue

        try:
            vectorizer = TfidfVectorizer(max_features=500, ngram_range=(1, 2))
            matrix = vectorizer.fit_transform(corpus)
            feature_names = vectorizer.get_feature_names_out()
            jd_scores = matrix[0].toarray()[0]
            top_indices = jd_scores.argsort()[::-1][:top_n]

            weighted_keywords = []
            for i in top_indices:
                if jd_scores[i] <= 0:
                    continue
                weight = float(jd_scores[i]) if settings.KEYWORD_WEIGHTING_ENABLED else 1.0
                weighted_keywords.append((feature_names[i], weight))

            keywords[jd_name] = weighted_keywords
        except ValueError:
            keywords[jd_name] = []

    return keywords


def vectorize_documents(cv_docs, jd_docs):
    all_docs = {**cv_docs, **jd_docs}

    cv_vectors  = get_document_vectors(cv_docs, all_docs)
    jd_vectors  = get_document_vectors(jd_docs, all_docs)
    jd_keywords = get_top_keywords(jd_docs, cv_docs)

    return cv_vectors, jd_vectors, jd_keywords