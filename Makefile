SHELL := /bin/bash

PYTHON ?= python3
BACKEND_DIR := backend
UI_DIR := ui
VENV := $(BACKEND_DIR)/.venv

# Ensure make doesn't run targets in parallel by default for setup.
.NOTPARALLEL:

.PHONY: setup backend ui dev test

setup:
	@echo "[setup] Checking ffmpeg..."
	@command -v ffmpeg >/dev/null 2>&1 || (echo "ffmpeg not found. Install with: brew install ffmpeg" && exit 1)
	@echo "[setup] Creating Python venv..."
	@$(PYTHON) -m venv $(VENV)
	@echo "[setup] Installing backend deps (including test extras)..."
	@$(VENV)/bin/pip install --upgrade pip
	@$(VENV)/bin/pip install -e $(BACKEND_DIR)[test]
	@echo "[setup] Installing UI deps..."
	@cd $(UI_DIR) && npm install
	@echo "[setup] Done."

backend:
	@echo "[backend] Starting FastAPI backend..."
	@$(VENV)/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload --app-dir $(BACKEND_DIR)

ui:
	@echo "[ui] Starting Tauri dev..."
	@cd $(UI_DIR) && npm run tauri dev

# Keep dev simple and explicit for MVP.
# Running both in one shell is possible with tools like concurrently, but we keep it minimal.
dev:
	@echo "Run in two terminals:"
	@echo "  make backend"
	@echo "  make ui"

# Run backend tests only (UI has no tests in MVP).
test:
	@echo "[test] Running backend pytest..."
	@$(VENV)/bin/pytest -q $(BACKEND_DIR)/tests
