from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ImageRecord(Base):
    __tablename__ = "images"
    
    id = Column(String, primary_key=True)  # UUID
    filename = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    
    # Analysis Results
    center_ra = Column(Float, nullable=True)
    center_dec = Column(Float, nullable=True)
    
    detections = relationship("Detection", back_populates="image")

class Detection(Base):
    __tablename__ = "detections"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    image_id = Column(String, ForeignKey("images.id"))
    
    # YOLO Outputs
    label = Column(String)
    confidence = Column(Float)
    x = Column(Float)
    y = Column(Float)
    w = Column(Float)
    h = Column(Float)
    
    # Plugin Enrichments (Gemini & Gaia)
    real_name = Column(String, nullable=True)
    distance_pc = Column(String, nullable=True) # Distance
    description = Column(String, nullable=True) # AI Description
    
    image = relationship("ImageRecord", back_populates="detections")
