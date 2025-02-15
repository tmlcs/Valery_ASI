#!/bin/bash
cd "$(dirname "$0")"
pip install -e .
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
uvicorn agent_ai.fastapi:app --host 0.0.0.0 --port 8000 --reload
