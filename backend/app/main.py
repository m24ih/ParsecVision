from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app import models
from pydantic import BaseModel
from app.services.llm_service import LLMService

# 1. Uygulama başlarken tabloları oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParsecVision Core")

@app.get("/")
def health_check():
    return {"status": "operational", "system": "ParsecVision"}

@app.get("/db-test")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        # Basit bir sorgu ile bağlantıyı test et
        db.execute("SELECT 1")
        return {"database": "connected"}
    except Exception as e:
        return {"database": "error", "detail": str(e)}

# --- GEMINI INTEGRATION ---

class AnalysisRequest(BaseModel):
    name: str
    obj_type: str
    distance: str

@app.post("/analyze-text")
def analyze_object_text(request: AnalysisRequest):
    """
    Manuel veri girişi ile Gemini analizini test eder.
    """
    llm = LLMService()
    summary = llm.analyze_celestial_object(
        obj_name=request.name,
        obj_type=request.obj_type,
        distance=request.distance
    )
    return {"analysis": summary}