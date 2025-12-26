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

# Tabloları oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParsecVision Core 0.2.0")
# --- CORS AYARLARI (YENİ) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Güvenlik notu: Prodüksiyonda sadece "http://localhost:5173" olmalı
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servisleri başlat
yolo_service = YOLOService()
# Gemini servisini her istekte başlatmak yerine burada global tanımlayabiliriz 
# ama API key hatası almamak için endpoint içinde çağırmak daha güvenli olabilir.

@app.post("/upload-and-detect")
async def process_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    1. Görüntüyü kaydeder.
    2. YOLO ile tarar.
    3. Sonuçları veritabanına yazar.
    """
    # Klasör kontrolü
    upload_dir = "data/raw"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Dosya kaydetme
    file_id = str(uuid.uuid4())
    file_ext = file.filename.split(".")[-1]
    file_path = f"{upload_dir}/{file_id}.{file_ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # DB Kaydı (Resim)
    db_image = models.ImageRecord(
        id=file_id, 
        filename=file.filename, 
        status="processed"
    )
    db.add(db_image)
    
    # YOLO Analizi
    results = yolo_service.detect_objects(file_path)
    
    # DB Kaydı ve Yanıt Hazırlığı
    response_detections = [] # Frontend'e dönecek liste
    
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
        db.flush() # Commit etmeden ID alabilmek için flush yapıyoruz
        db.refresh(new_det) # ID'yi nesneye yükle
        
        # Yanıt listesine ID ile birlikte ekle
        response_detections.append({
            "id": new_det.id, # İŞTE EKSİK OLAN PARÇA BU
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
        "results": response_detections # Artık içinde ID'ler var
    }

@app.post("/explain-detection/{detection_id}")
def explain_detection_with_gemini(detection_id: int, db: Session = Depends(get_db)):
    """
    Veritabanındaki belirli bir tespiti (örneğin 'star') Gemini'ye sorar.
    """
    # 1. Tespiti bul
    detection = db.query(models.Detection).filter(models.Detection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Tespit bulunamadı")
        
    # 2. Eğer zaten açıklama varsa tekrar sorma (Maliyet/Hız)
    if detection.description:
        return {"source": "cache", "description": detection.description}
    
    # 3. Gemini'ye sor
    llm = LLMService()
    # Not: Gerçek koordinat dönüşümü yapmadığımız için şimdilik sadece türünü soruyoruz.
    # İleride buraya "Bu cisim X:100 Y:200 koordinatındadır" bilgisini de ekleyeceğiz.
    summary = llm.analyze_celestial_object(
        obj_name=f"Bilinmeyen {detection.label}", # Şimdilik genel isim
        obj_type=detection.label,
        distance="Bilinmiyor"
    )
    
    # 4. Cevabı kaydet
    detection.description = summary
    db.commit()
    
    return {"source": "gemini", "description": summary}
