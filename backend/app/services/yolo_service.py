from ultralytics import YOLO
import os

class YOLOService:
    def __init__(self):
        model_path = "/app/yolo11n.pt"
        if os.path.exists(model_path):
            self.model = YOLO(model_path)
        else:
            # Yedek plan (ama manuel koyduğun için buraya düşmemeli)
            print("Model dosyası bulunamadı, indirmeyi deniyor...")
            self.model = YOLO("yolo11n.pt")
    def detect_objects(self, image_path: str):
        results = self.model(image_path)
        detections = []
        for r in results:
            for box in r.boxes:
                detections.append({
                    "label": self.model.names[int(box.cls)],
                    "confidence": round(float(box.conf), 2),
                    "box": {
                        "x": round(float(box.xywh[0][0]), 2),
                        "y": round(float(box.xywh[0][1]), 2),
                        "w": round(float(box.xywh[0][2]), 2),
                        "h": round(float(box.xywh[0][3]), 2)
                    }
                })
        return detections
