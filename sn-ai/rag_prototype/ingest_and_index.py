import json
import pickle
from pathlib import Path
import math
from collections import Counter, defaultdict


DATA_PATH = Path(__file__).parent / "data" / "sample_itsm_data.json"
INDEX_PATH = Path(__file__).parent / "index.pkl"


def load_records(path=DATA_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_chunks(records):
    chunks = []
    metadata = []

    for rec in records:
        title = rec.get("short_description", "")
        body = rec.get("description", "")
        combined = f"{title}\n\n{body}".strip()
        if not combined:
            continue
        chunks.append(combined)
        metadata.append({
            "sys_id": rec.get("sys_id"),
            "number": rec.get("number"),
            "type": rec.get("type"),
            "category": rec.get("category"),
            "tags": rec.get("tags", []),
        })

    return chunks, metadata


def tokenize(text):
    tokens = []
    cur = []
    for ch in text.lower():
        if ch.isalnum():
            cur.append(ch)
        else:
            if cur:
                tokens.append("".join(cur))
                cur = []
    if cur:
        tokens.append("".join(cur))
    return tokens


def build_tfidf_index(chunks, index_path=INDEX_PATH):
    docs_tokens = [tokenize(c) for c in chunks]

    df = defaultdict(int)
    for tokens in docs_tokens:
        seen = set()
        for t in tokens:
            if t not in seen:
                df[t] += 1
                seen.add(t)

    N = len(docs_tokens)
    idf = {term: math.log((N + 1) / (count + 1)) + 1.0 for term, count in df.items()}

    vocab = {t: i for i, t in enumerate(sorted(idf.keys()))}

    vectors = []
    norms = []
    for tokens in docs_tokens:
        tf = Counter(tokens)
        vec = {}
        total_terms = len(tokens) if tokens else 1
        for term, cnt in tf.items():
            if term in idf:
                val = (cnt / total_terms) * idf[term]
                vec[term] = val
        norm = math.sqrt(sum(v * v for v in vec.values()))
        vectors.append(vec)
        norms.append(norm)

    index = {"vocab": vocab, "idf": idf, "vectors": vectors, "norms": norms, "chunks": chunks}
    with open(index_path, "wb") as f:
        pickle.dump(index, f)

    print(f"Index built with {len(chunks)} chunks and saved to {index_path}")


if __name__ == '__main__':
    records = load_records()
    chunks, metadata = build_chunks(records)
    build_tfidf_index(chunks)
