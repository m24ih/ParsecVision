from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ImageRecord(Base):
    __tablename__ = "images"
    
    id = Column(String, primary_key=True)  # UUID
    filename = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")
    
    # Harita Oranları
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    
    # Analysis Results (Astrometry API)
    center_ra = Column(Float, nullable=True)
    center_dec = Column(Float, nullable=True)
    
    # --- YENİ EKLENEN BİLİMSEL VERİ SÜTUNLARI (SIMBAD & AI) ---
    target_name = Column(String, default="Unknown Deep Space Object")
    magnitude = Column(String, default="N/A")
    spectral_class = Column(String, default="N/A")
    distance = Column(String, default="N/A")
    confidence = Column(Float, nullable=True)
    ai_analysis = Column(String, nullable=True)
    
    # --- GALERİ AYRIMI İÇİN YENİ SÜTUN ---
    is_public = Column(Integer, default=0)  # Boolean yerine Integer (SQLite uyumluluğu için 0 veya 1)
    is_analyzed = Column(Integer, default=1) # 1: Analyzed, 0: Raw Pool
    
    detections = relationship("Detection", back_populates="image")

class Detection(Base):
    __tablename__ = "detections"
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(String, ForeignKey("images.id"))
    label = Column(String)
    confidence = Column(Float)
    x = Column(Float)
    y = Column(Float)
    w = Column(Float)
    h = Column(Float)
    
    # AI Analizleri
    description = Column(String, nullable=True)
    
    # SAM Entegrasyonu için yeni sütun
    # Maske verisi (piksel maskeleri JSON veya RLE formatında saklanacak)
    mask = Column(String, nullable=True)
    
    # Plugin Enrichments
    real_name = Column(String, nullable=True)
    distance_pc = Column(String, nullable=True)
    
    image = relationship("ImageRecord", back_populates="detections")