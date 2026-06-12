import os
import cv2
import uuid
import math
import json
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from pydantic import BaseModel
from app.database import engine, Base, get_db
from app import models
from app.services.yolo_service import YOLOService
from app.services.llm_service import LLMService
from app.services.astrometry_service import AstrometryService
from app.services.sam_service import SAMService

# SIMBAD ve Astropy
from astroquery.simbad import Simbad
from astropy.coordinates import SkyCoord
import astropy.units as u
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
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
os.makedirs("data/gallery", exist_ok=True)
app.mount("/images", StaticFiles(directory="data/raw"), name="images")
app.mount("/gallery-images", StaticFiles(directory="data/gallery"), name="gallery-images")

yolo_service = YOLOService()
llm_service = LLMService()
astrometry_service = AstrometryService()
sam_service = SAMService()

class CosmicRequest(BaseModel):
    ra: float
    dec: float
    image_id: str = None

custom_simbad = Simbad()
custom_simbad.add_votable_fields('flux(V)', 'sp_type', 'plx')

def fetch_simbad_data(ra: float, dec: float):
    try:
        c = SkyCoord(ra=ra, dec=dec, unit=(u.deg, u.deg), frame='icrs')
        result_table = custom_simbad.query_region(c, radius=15 * u.arcmin)
        if result_table is None or len(result_table) == 0: return None
        
        if 'FLUX_V' in result_table.colnames:
            result_table.sort('FLUX_V')
        best = result_table[0]
        
        target = str(best['MAIN_ID'].decode('utf-8') if isinstance(best['MAIN_ID'], bytes) else best['MAIN_ID'])
        mag = f"{best['FLUX_V']:.2f} (V)" if ('FLUX_V' in best.colnames and not math.isnan(best['FLUX_V'])) else "N/A"
        sp = best['SP_TYPE'].decode('utf-8') if ('SP_TYPE' in best.colnames and best['SP_TYPE']) else "N/A"
        dist = f"~{(1000 / best['PLX_VALUE']) * 3.262:,.0f} ly" if ('PLX_VALUE' in best.colnames and best['PLX_VALUE'] > 0) else "N/A"
            
        return {"target_name": target, "magnitude": mag, "spectral_class": str(sp), "distance": dist}
    except Exception as e:
        print(f"DEBUG: SIMBAD Sorgu Hatası: {e}")
        return None

@app.post("/upload-and-detect")
def process_image(file: UploadFile = File(...), is_public: int = Form(0), db: Session = Depends(get_db)):
    try:
        # Check if an analyzed image with the exact same filename already exists
        existing_image = db.query(models.ImageRecord).filter(
            models.ImageRecord.filename == file.filename,
            models.ImageRecord.is_analyzed == 1,
            models.ImageRecord.ai_analysis.isnot(None),
            models.ImageRecord.ai_analysis.notlike('%Analysis Unavailable%')
        ).order_by(models.ImageRecord.uploaded_at.desc()).first()

        if existing_image:
            folder = "data/gallery" if existing_image.is_public == 1 else "data/raw"
            ext = existing_image.filename.split('.')[-1]
            existing_file_path = f"{folder}/{existing_image.id}.{ext}"
            if os.path.exists(existing_file_path):
                astro_result = {
                    "status": "success" if existing_image.center_ra is not None else "error",
                    "ra": existing_image.center_ra,
                    "dec": existing_image.center_dec
                }
                data = {
                    "target_name": existing_image.target_name,
                    "magnitude": existing_image.magnitude,
                    "spectral_class": existing_image.spectral_class,
                    "distance": existing_image.distance
                }
                if existing_image.ai_analysis:
                    clean_json = existing_image.ai_analysis.replace("```json", "").replace("```", "").strip()
                    try:
                        parsed = json.loads(clean_json)
                        data["key_features"] = parsed.get("key_features", "N/A")
                        data["cosmic_note"] = parsed.get("cosmic_note", "No extra info.")
                        data["detailed_analysis"] = parsed.get("detailed_analysis", "")
                    except:
                        pass
                return {
                    "image_id": existing_image.id,
                    "filename": existing_image.filename,
                    "width": existing_image.width,
                    "height": existing_image.height,
                    "astrometry": astro_result,
                    **data,
                    "confidence": existing_image.confidence or 0.942
                }

        file_id = str(uuid.uuid4())
        folder = "data/gallery" if is_public == 1 else "data/raw"
        file_path = f"{folder}/{file_id}.{file.filename.split('.')[-1]}"
        with open(file_path, "wb") as f: f.write(file.file.read())

        db_image = models.ImageRecord(id=file_id, filename=file.filename, is_public=is_public)
        db.add(db_image); db.commit()

        results = yolo_service.detect_objects(file_path)
        
        try:
            astro_result = astrometry_service.solve_image(file_path)
        except Exception as e:
            astro_result = {"status": "error"}

        img = cv2.imread(file_path)
        if img is not None:
            db_image.width = img.shape[1]
            db_image.height = img.shape[0]
            
        data = {
            "target_name": "Deep Space Object",
            "magnitude": "N/A",
            "spectral_class": "N/A",
            "distance": "N/A",
            "key_features": "N/A",
            "cosmic_note": "No extra info.",
            "detailed_analysis": "",
            "anomaly_scores": None
        }
        
        if astro_result and astro_result.get("status") == "success":
            ra, dec = astro_result.get("ra"), astro_result.get("dec")
            db_image.center_ra, db_image.center_dec = ra, dec
            
            simbad_data = fetch_simbad_data(ra, dec)
            if simbad_data:
                data.update(simbad_data)
            
            raw_analysis = llm_service.analyze_coordinates(ra, dec, simbad_data=simbad_data)
            if raw_analysis and "Analysis Unavailable" not in raw_analysis:
                db_image.ai_analysis = raw_analysis
            
            clean_json = raw_analysis.replace("```json", "").replace("```", "").strip()
            try:
                parsed = json.loads(clean_json)
                if not simbad_data:
                    data["target_name"] = parsed.get("region_name", "Region identified by AI")
                    data["distance"] = "AI Analysis"
                data["key_features"] = parsed.get("key_features", "N/A")
                data["cosmic_note"] = parsed.get("cosmic_note", "No extra info.")
                data["detailed_analysis"] = parsed.get("detailed_analysis", "")
                data["anomaly_scores"] = parsed.get("anomaly_scores", None)
            except Exception as e:
                print(f"DEBUG: JSON parse error: {e}")

            db_image.target_name = data.get("target_name")
            db_image.magnitude = data.get("magnitude")
            db_image.spectral_class = data.get("spectral_class")
            db_image.distance = data.get("distance")

        db.commit()
        return {
            "image_id": file_id, "filename": file.filename, "width": img.shape[1], "height": img.shape[0],
            "astrometry": astro_result, **data, "confidence": 0.942
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-raw")
def upload_raw(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        file_id = str(uuid.uuid4())
        folder = "data/gallery"
        file_path = f"{folder}/{file_id}.{file.filename.split('.')[-1]}"
        with open(file_path, "wb") as f: f.write(file.file.read())

        db_image = models.ImageRecord(id=file_id, filename=file.filename, is_public=1, is_analyzed=0)
        db.add(db_image); db.commit()

        img = cv2.imread(file_path)
        if img is not None:
            db_image.width = img.shape[1]
            db_image.height = img.shape[0]
            db.commit()

        return {
            "image_id": file_id, "filename": file.filename, 
            "width": db_image.width, "height": db_image.height,
            "is_public": 1, "is_analyzed": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-existing/{image_id}")
def analyze_existing(image_id: str, db: Session = Depends(get_db)):
    db_image = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not db_image:
        raise HTTPException(status_code=404, detail="Image not found")
        
    folder = "data/gallery" if db_image.is_public == 1 else "data/raw"
    ext = db_image.filename.split('.')[-1]
    file_path = f"{folder}/{image_id}.{ext}"
    
    try:
        results = yolo_service.detect_objects(file_path)
        
        try:
            astro_result = astrometry_service.solve_image(file_path)
        except Exception as e:
            astro_result = {"status": "error"}

        data = {
            "target_name": "Deep Space Object",
            "magnitude": "N/A",
            "spectral_class": "N/A",
            "distance": "N/A",
            "key_features": "N/A",
            "cosmic_note": "No extra info.",
            "detailed_analysis": "",
            "anomaly_scores": None
        }
        
        if astro_result and astro_result.get("status") == "success":
            ra, dec = astro_result.get("ra"), astro_result.get("dec")
            db_image.center_ra, db_image.center_dec = ra, dec
            
            simbad_data = fetch_simbad_data(ra, dec)
            if simbad_data:
                data.update(simbad_data)
            
            raw_analysis = llm_service.analyze_coordinates(ra, dec, simbad_data=simbad_data)
            if raw_analysis and "Analysis Unavailable" not in raw_analysis:
                db_image.ai_analysis = raw_analysis
            
            clean_json = raw_analysis.replace("```json", "").replace("```", "").strip()
            try:
                parsed = json.loads(clean_json)
                if not simbad_data:
                    data["target_name"] = parsed.get("region_name", "Region identified by AI")
                    data["distance"] = "AI Analysis"
                data["key_features"] = parsed.get("key_features", "N/A")
                data["cosmic_note"] = parsed.get("cosmic_note", "No extra info.")
                data["detailed_analysis"] = parsed.get("detailed_analysis", "")
                data["anomaly_scores"] = parsed.get("anomaly_scores", None)
            except Exception as e:
                print(f"DEBUG: JSON parse error: {e}")

            db_image.target_name = data.get("target_name")
            db_image.magnitude = data.get("magnitude")
            db_image.spectral_class = data.get("spectral_class")
            db_image.distance = data.get("distance")

        db_image.is_analyzed = 1
        db.commit()
        return {
            "image_id": image_id, "filename": db_image.filename, 
            "width": db_image.width, "height": db_image.height,
            "astrometry": astro_result, **data, "confidence": 0.942
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/segment-detection/{detection_id}")
def segment_detection(detection_id: int, db: Session = Depends(get_db)):
    detection = db.query(models.Detection).filter(models.Detection.id == detection_id).first()
    image_record = db.query(models.ImageRecord).filter(models.ImageRecord.id == detection.image_id).first()
    mask_json = sam_service.generate_mask(f"data/raw/{image_record.filename}", [detection.x, detection.y, detection.x + detection.w, detection.y + detection.h])
    detection.mask = mask_json
    db.commit()
    return {"status": "success", "mask": mask_json}

@app.post("/explain-detection/{detection_id}")
def explain_detection(detection_id: int, db: Session = Depends(get_db)):
    detection = db.query(models.Detection).filter(models.Detection.id == detection_id).first()
    if not detection.description:
        detection.description = llm_service.explain_detection(detection.label)
        db.commit()
    return {"description": detection.description}

@app.post("/analyze-cosmic")
def analyze_cosmic(req: CosmicRequest, db: Session = Depends(get_db)):
    # Önce veri tabanında bu resim için yapılmış bir analiz var mı kontrol et
    image_record = None
    if req.image_id:
        image_record = db.query(models.ImageRecord).filter(models.ImageRecord.id == req.image_id).first()
        if image_record and image_record.ai_analysis and "Analysis Unavailable" not in image_record.ai_analysis:
            return {"analysis": image_record.ai_analysis}

    # Extract any existing SIMBAD info from image_record if available, otherwise fetch it
    simbad_data = None
    if image_record and image_record.target_name and image_record.target_name != "Unknown Deep Space Object":
        simbad_data = {
            "target_name": image_record.target_name,
            "magnitude": image_record.magnitude,
            "spectral_class": image_record.spectral_class,
            "distance": image_record.distance
        }
    else:
        simbad_data = fetch_simbad_data(req.ra, req.dec)

    # Yoksa yeni analiz yap
    analysis_text = llm_service.analyze_coordinates(req.ra, req.dec, simbad_data=simbad_data)
    
    # Eğer dönen metin bir hata mesajı değilse veritabanına kaydet
    if req.image_id and "Analysis Unavailable" not in analysis_text:
        if image_record:
            image_record.ai_analysis = analysis_text
            if simbad_data:
                image_record.target_name = simbad_data.get("target_name")
                image_record.magnitude = simbad_data.get("magnitude")
                image_record.spectral_class = simbad_data.get("spectral_class")
                image_record.distance = simbad_data.get("distance")
            db.commit()
            
    return {"analysis": analysis_text}

@app.get("/history")
def get_history(db: Session = Depends(get_db)):
    # Personal history (shows all images analyzed locally)
    records = db.query(models.ImageRecord).filter(
        models.ImageRecord.is_analyzed == 1,
        models.ImageRecord.ai_analysis.isnot(None),
        models.ImageRecord.ai_analysis.notlike('%API Limit Reached%'),
        models.ImageRecord.ai_analysis.notlike('%Analysis Unavailable%')
    ).order_by(models.ImageRecord.uploaded_at.desc()).all()
    history = []
    for r in records:
        ext = r.filename.split('.')[-1] if r.filename else 'jpg'
        folder = "gallery" if r.is_public == 1 else "raw"
        file_path = os.path.join("data", folder, f"{r.id}.{ext}")
        if not os.path.exists(file_path):
            continue

        history.append({
            "image_id": r.id,
            "filename": r.filename,
            "uploaded_at": r.uploaded_at.isoformat(),
            "target_name": r.target_name,
            "ra": r.center_ra,
            "dec": r.center_dec,
            "ai_analysis": r.ai_analysis,
            "is_public": r.is_public,
            "distance": r.distance,
            "magnitude": r.magnitude,
            "spectral_class": r.spectral_class,
            "width": r.width,
            "height": r.height
        })
    return {"history": history}

@app.get("/community-gallery")
def get_community_gallery(db: Session = Depends(get_db)):
    # Show ALL analyzed images AND ALL raw gallery images
    records = db.query(models.ImageRecord).filter(
        or_(
            models.ImageRecord.is_analyzed == 1,
            models.ImageRecord.is_public == 1
        ),
        or_(
            models.ImageRecord.ai_analysis.is_(None),
            models.ImageRecord.ai_analysis.notlike('%API Limit Reached%')
        ),
        or_(
            models.ImageRecord.ai_analysis.is_(None),
            models.ImageRecord.ai_analysis.notlike('%Analysis Unavailable%')
        )
    ).order_by(models.ImageRecord.uploaded_at.desc()).limit(50).all()
    gallery = []
    for r in records:
        ext = r.filename.split('.')[-1] if r.filename else 'jpg'
        folder = "gallery" if r.is_public == 1 else "raw"
        file_path = os.path.join("data", folder, f"{r.id}.{ext}")
        if not os.path.exists(file_path):
            continue

        gallery.append({
            "image_id": r.id,
            "filename": r.filename,
            "uploaded_at": r.uploaded_at.isoformat(),
            "target_name": r.target_name,
            "ra": r.center_ra,
            "dec": r.center_dec,
            "ai_analysis": r.ai_analysis,
            "is_public": r.is_public,
            "is_analyzed": r.is_analyzed,
            "distance": r.distance,
            "magnitude": r.magnitude,
            "spectral_class": r.spectral_class,
            "width": r.width,
            "height": r.height
        })
    return {"gallery": gallery}