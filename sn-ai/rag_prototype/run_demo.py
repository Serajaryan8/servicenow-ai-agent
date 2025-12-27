import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent


def run(cmd):
    print(f"\n>> {cmd}")
    res = subprocess.run(cmd, shell=True)
    if res.returncode != 0:
        print(f"Command failed: {cmd}")
        sys.exit(1)


if __name__ == '__main__':
    # Build index
    run(f"{sys.executable} {ROOT / 'ingest_and_index.py'}")

    # Example queries
    queries = [
        "password reset",
        "vpn connection timeout",
        "database connection pool increase"
    ]

    for q in queries:
        print('\n' + '='*80)
        print(f"Query: {q}\n")
        run(f"{sys.executable} {ROOT / 'query_rag.py'} \"{q}\"")
