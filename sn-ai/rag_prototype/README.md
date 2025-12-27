RAG Prototype (TF-IDF)

This is a minimal Retrieval-Augmented Generation (RAG) prototype using TF-IDF for retrieval.

Files:
- `ingest_and_index.py` — Builds TF-IDF index and metadata from sample ServiceNow data.
- `query_rag.py` — Run a query, retrieve top-k contexts and assemble a simple RAG response.
- `run_demo.py` — Runs ingestion then executes example queries.

How to run:

```bash
cd "e:\GenAI Course\sn-ai"
python -m pip install -r rag_prototype/requirements.txt
python rag_prototype/run_demo.py
```

Notes:
- This demo uses a TF-IDF vectorizer instead of neural embeddings so it runs locally without API keys.
- Data source: `data/sample_itsm_data.json` (copied into this folder).
