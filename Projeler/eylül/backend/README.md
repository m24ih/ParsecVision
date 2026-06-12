# 🔧 Backend Developer Notes

This is the engine room of **ParsecVision**. Please pay attention to the following rules and warnings when writing code.

## 🚨 CRITICAL WARNINGS

1.  **Model File (`.pt`):**
    - `yolo11n.pt` file is blocked by `.gitignore`.
    - Download may timeout during Docker build if internet is slow.
    - **Solution:** Manually download the model and place it in the `backend/` root directory. The code is set to check `/app/yolo11n.pt`.

2.  **Database Schema (No Migrations!):**
    - We are currently not using Alembic. Tables are automatically created with `Base.metadata.create_all`.
    - **Warning:** If you modify a table in `models.py`, changes will not reflect unless you delete the Docker volume!
    - _DB Reset:_ `docker-compose down -v` (Data will be lost!)

3.  **VSCode & IntelliSense:**
    - Although the code runs in Docker, you should set up a local virtual environment for VSCode not to "complain":
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

    - _Note:_ This is only for the editor, use Docker to run.

## 🔑 Environment (.env)

The following must be present in the `.env` file in the root directory for the Backend to work:

```ini
GEMINI_API_KEY=AIzaSy...
```

If you don't write it, the /analyze-text endpoint will return an "API Key Missing" error.

## 📡 API Test

Backend port: 8001 (Should not be 8000 to avoid conflict with Eco Kitchen!)

Docs: http://localhost:8001/docs

---
