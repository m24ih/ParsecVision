# ParsecVision 🌌

**ParsecVision**, uzay görüntülerini analiz eden, gök cisimlerini tespit eden ve yapay zeka destekli bilimsel açıklamalar sunan tam kapsamlı bir astronomik analiz sistemidir.

Proje; modern mikroservis mimarisi, konteynerizasyon ve hibrit yapay zeka (Computer Vision + LLM) teknolojilerini birleştirir.

---

## 🚀 Mimari ve Teknoloji Yığını

Sistem, Docker üzerinde çalışan izole servislerden oluşur:

| Katman           | Teknoloji               | Görevi                                                           |
| :--------------- | :---------------------- | :--------------------------------------------------------------- |
| **Frontend**     | React (Vite), Leaflet   | Kullanıcı arayüzü ve CRS.Simple harita görselleştirme.           |
| **Backend**      | FastAPI (Python 3.10)   | REST API, iş mantığı ve orkestrasyon.                            |
| **Göz (Vision)** | YOLOv11 (Ultralytics)   | Görüntü üzerindeki nesnelerin tespiti ve koordinatları.          |
| **Beyin (LLM)**  | Google Gemini 3.0 Flash | Tespit edilen cisimlerin bilimsel analizi ve hikayeleştirilmesi. |
| **Hafıza (DB)**  | PostgreSQL 15           | Görüntü metadata'sı ve analiz sonuçlarının saklanması.           |
| **DevOps**       | Docker & Docker Compose | Tüm altyapının tek komutla ayağa kaldırılması.                   |

---

## 🛠 Kurulum ve Çalıştırma

Proje **Docker First** yaklaşımıyla geliştirilmiştir. Yerel makinenizde sadece Docker'ın kurulu olması yeterlidir.

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/m24ih/ParsecVision.git
cd ParsecVision
```

### 2. Ortam Değişkenlerini Ayarlayın

Ana dizinde bir .env dosyası oluşturun ve Google Gemini API anahtarınızı ekleyin:

```ini
# .env
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@db:5432/parsec_db
```

### 3. Sistemi Başlatın

```Bash
docker-compose up --build -d
```

Not: İlk kurulumda YOLO modeli ve NPM paketleri nedeniyle işlem birkaç dakika sürebilir.

## 📡 Servis Endpoints

Sistem ayağa kalktığında aşağıdaki adreslerden erişilebilir:

Frontend Arayüzü: http://localhost:5173

Backend API & Swagger: http://localhost:8001/docs

Veritabanı Portu: 5433 (Yerel erişim için yönlendirilmiştir)

## 📂 Proje Yapısı

```
ParsecVision/
├── backend/
│   ├── app/
│   │   ├── main.py          # API Gateway & Logic
│   │   ├── models.py        # SQLAlchemy DB Modelleri
│   │   ├── services/
│   │   │   ├── yolo_service.py  # Nesne Tespiti
│   │   │   └── llm_service.py   # Gemini Entegrasyonu
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Ana UI Mantığı
│   │   └── index.css        # Sci-Fi Stil Dosyası
│   ├── Dockerfile
│   └── package.json
├── data/                    # Yüklenen görseller (Volume)
└── docker-compose.yml       # Orkestrasyon
```

## 🧪 Özellikler (Mevcut Durum: v0.5 Alpha)

[x] Görüntü Yükleme Hattı: Ham görüntülerin işlenmesi ve arşivlenmesi.

[x] Otomatik Tespit: YOLO modeli ile görüntüdeki nesnelerin (şimdilik genel nesneler) tespiti.

[x] AI Analizi: Tespit edilen nesne hakkında Gemini üzerinden anlık Türkçe bilimsel rapor.

[x] Tam Docker İzolasyonu: Frontend ve Backend arasında CORS yapılandırılmış iletişim.

## 🗺 Yol Haritası

[ ] Leaflet Entegrasyonu: Görüntülerin harita katmanı olarak sunulması.

[ ] Astroquery: Gerçek uzay koordinatlarının (RA/Dec) çözümlenmesi.

[ ] Custom Model: YOLO'nun gerçek uzay nesneleri (Galaksi, Nebula) için eğitilmesi.

---
