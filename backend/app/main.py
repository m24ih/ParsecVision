import os
import cv2
import uuid
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import engine, Base, get_db
from app import models
from app.services.yolo_service import YOLOService
from app.services.llm_service import LLMService
from app.services.astrometry_service import AstrometryService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParsecVision Core 0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("data/raw", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/raw"), name="images")

yolo_service = YOLOService()
llm_service = LLMService()
astrometry_service = AstrometryService()


class CosmicRequest(BaseModel):
    ra: float
    dec: float


@app.post("/upload-and-detect")
def process_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_id = str(uuid.uuid4())
    extension = file.filename.split(".")[-1]
    file_path = f"data/raw/{file_id}.{extension}"

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    db_image = models.ImageRecord(id=file_id, filename=file.filename)

    db.add(db_image)
    db.commit()

    results = yolo_service.detect_objects(file_path)
    astro_result = astrometry_service.solve_image(file_path)

    response_detections = []
    for det in results:
        new_det = models.Detection(
            image_id=file_id,
            label=det["label"],
            confidence=det["confidence"],
            x=det["box"]["x"],
            y=det["box"]["y"],
            w=det["box"]["w"],
            h=det["box"]["h"],
        )
        db.add(new_det)
        db.flush()
        db.refresh(new_det)
        response_detections.append(
            {
                "id": new_det.id,
                "label": new_det.label,
                "confidence": new_det.confidence,
                "box": {"x": new_det.x, "y": new_det.y, "w": new_det.w, "h": new_det.h},
            }
        )

    img = cv2.imread(file_path)
    img_h, img_w = img.shape[:2]

    db.commit()

    return {
        "image_id": file_id,
        "width": img_w,
        "height": img_h,
        "detections_found": len(results),
        "astrometry": astro_result,
        "results": response_detections,
    }


@app.post("/explain-detection/{detection_id}")
def explain_detection(detection_id: int, db: Session = Depends(get_db)):
    detection = (
        db.query(models.Detection).filter(models.Detection.id == detection_id).first()
    )
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")

    explanation = llm_service.explain_detection(detection.label)
    return {"description": explanation}


@app.post("/analyze-cosmic")
def analyze_cosmic(req: CosmicRequest):
    analysis = llm_service.analyze_coordinates(req.ra, req.dec)
    return {"analysis": analysis}
