import pickle
from pathlib import Path
import math

INDEX_PATH = Path(__file__).parent / "index.pkl"


def load_index():
    with open(INDEX_PATH, "rb") as f:
        return pickle.load(f)


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


def dot_product(a: dict, b: dict) -> float:
    s = 0.0
    # iterate over smaller dict
    if len(a) > len(b):
        a, b = b, a
    for k, v in a.items():
        if k in b:
            s += v * b[k]
    return s


def query(query_text: str, top_k: int = 3):
    idx = load_index()
    idf = idx["idf"]
    vectors = idx["vectors"]
    norms = idx["norms"]
    chunks = idx["chunks"]

    tokens = tokenize(query_text)
    tf = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1

    total_terms = len(tokens) if tokens else 1
    qvec = {}
    for term, cnt in tf.items():
        if term in idf:
            qvec[term] = (cnt / total_terms) * idf[term]

    qnorm = math.sqrt(sum(v * v for v in qvec.values()))

    sims = []
    for vec, norm in zip(vectors, norms):
        if qnorm == 0 or norm == 0:
            sims.append(0.0)
            continue
        dp = dot_product(qvec, vec)
        sims.append(dp / (qnorm * norm))

    # get top_k indices
    ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)[:top_k]

    results = []
    for i, score in ranked:
        results.append({"score": float(score), "chunk": chunks[i], "metadata": {}})

    return results


def assemble_answer(query_text: str, results):
    answer = "Query: " + query_text + "\n\n"
    answer += "Retrieved contexts (top results):\n\n"

    for r in results:
        answer += f"- Score={r['score']:.3f}\n"
        excerpt = r["chunk"]
        if len(excerpt) > 300:
            excerpt = excerpt[:300] + "..."
        answer += f"  {excerpt}\n\n"

    answer += "Suggested action: use retrieved contexts to answer or call ServiceNow APIs."
    return answer


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
    else:
        q = input("Enter query: ")

    results = query(q)
    print(assemble_answer(q, results))
