import shutil
import uuid
import os
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app import models
from app.services.llm_service import LLMService
from app.services.yolo_service import YOLOService
from fastapi.middleware.cors import CORSMiddleware

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParsecVision Core 0.2.0")
# --- CORS SETTINGS (NEW) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Security note: In production this should be only "http://localhost:5173"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start services
yolo_service = YOLOService()
# We could initialize the Gemini service globally here instead of starting it with every request,
# but calling it inside the endpoint might be safer to avoid API key errors.

@app.post("/upload-and-detect")
async def process_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    1. Saves the image.
    2. Scans with YOLO.
    3. Writes results to database.
    """
    # Folder check
    upload_dir = "data/raw"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
    file_id = str(uuid.uuid4())
    file_ext = file.filename.split(".")[-1]
    file_path = f"{upload_dir}/{file_id}.{file_ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # DB Record (Image)
    db_image = models.ImageRecord(
        id=file_id, 
        filename=file.filename, 
        status="processed"
    )
    db.add(db_image)
    
    # YOLO Analysis
    results = yolo_service.detect_objects(file_path)
    
    # DB Record and Response Preparation
    response_detections = [] # List to return to Frontend
    
    for det in results:
        new_det = models.Detection(
            image_id=file_id,
            label=det["label"],
            confidence=det["confidence"],
            x=det["box"]["x"],
            y=det["box"]["y"],
            w=det["box"]["w"],
            h=det["box"]["h"]
        )
        db.add(new_det)
        db.flush() # We flush to get the ID without committing
        db.refresh(new_det) # Load ID into object
        
        # Add to response list with ID
        response_detections.append({
            "id": new_det.id,
            "label": new_det.label,
            "confidence": new_det.confidence,
            "box": {
                "x": new_det.x, "y": new_det.y, "w": new_det.w, "h": new_det.h
            }
        })
        
    db.commit()
    
    return {
        "image_id": file_id,
        "detections_found": len(results),
        "results": response_detections
    }

@app.post("/explain-detection/{detection_id}")
def explain_detection_with_gemini(detection_id: int, db: Session = Depends(get_db)):
    """
    Asks Gemini about a specific detection in the database (e.g. 'star').
    """
    # 1. Find the detection
    detection = db.query(models.Detection).filter(models.Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
        
    # 2. If description already exists, don't ask again (Cost/Speed)
    if detection.description:
        return {"source": "cache", "description": detection.description}
    
    # 3. Ask Gemini
    llm = LLMService()
    # Note: Since we are not doing real coordinate transformation, we only ask for the type for now.
    # In the future, we will add "This object is at coordinates X:100 Y:200" information here.
    summary = llm.analyze_celestial_object(
        obj_name=f"Unknown {detection.label}", # Generic name for now
        obj_type=detection.label,
        distance="Unknown"
    )
    
    # 4. Save the response
    detection.description = summary
    db.commit()
    
    return {"source": "gemini", "description": summary}
