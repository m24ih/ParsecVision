# ParsecVision 🌌

**ParsecVision** is a comprehensive astronomical analysis system that analyzes space imagery, detects celestial bodies, and provides AI-powered scientific explanations.

The project combines modern microservice architecture, containerization, and hybrid AI (Computer Vision + LLM) technologies.

---

## 🚀 Architecture and Technology Stack

The system consists of isolated services running on Docker:

| Layer            | Technology              | Role                                                         |
| :--------------- | :---------------------- | :----------------------------------------------------------- |
| **Frontend**     | React (Vite), Leaflet   | User interface and CRS.Simple map visualization.             |
| **Backend**      | FastAPI (Python 3.10)   | REST API, business logic, and orchestration.                 |
| **Eye (Vision)** | YOLOv11 (Ultralytics)   | Detection and coordinates of objects on the image.           |
| **Brain (LLM)**  | Google Gemini 3.0 Flash | Scientific analysis and storytelling of detected objects.    |
| **Memory (DB)**  | PostgreSQL 15           | Storage of image metadata and analysis results.              |
| **DevOps**       | Docker & Docker Compose | Bringing up the entire infrastructure with a single command. |

---

## 🛠 Installation and Execution

The project is developed with a **Docker First** approach. You only need to have Docker installed on your local machine.

### 1. Clone the Project

```bash
git clone https://github.com/m24ih/ParsecVision.git
cd ParsecVision
```

### 2. Set Environment Variables

Create a .env file in the root directory and add your Google Gemini API key:

```ini
# .env
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@db:5432/parsec_db
```

### 3. Start the System

```Bash
docker-compose up --build -d
```

Note: The first installation may take a few minutes due to the YOLO model and NPM packages.

## 📡 Service Endpoints

When the system is up, it can be accessed from the following addresses:

Frontend Interface: http://localhost:5173

Backend API & Swagger: http://localhost:8001/docs

Database Port: 5433 (Forwarded for local access)

## 📂 Project Structure

```
ParsecVision/
├── backend/
│   ├── app/
│   │   ├── main.py          # API Gateway & Logic
│   │   ├── models.py        # SQLAlchemy DB Models
│   │   ├── services/
│   │   │   ├── yolo_service.py  # Object Detection
│   │   │   └── llm_service.py   # Gemini Integration
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main UI Logic
│   │   └── index.css        # Sci-Fi Style File
│   ├── Dockerfile
│   └── package.json
├── data/                    # Uploaded images (Volume)
└── docker-compose.yml       # Orchestration
```

## 🧪 Features (Current Status: v0.5 Alpha)

[x] Image Upload Pipeline: Processing and archiving raw images.

[x] Automatic Detection: Detection of objects (generic objects for now) in the image with the YOLO model.

[x] AI Analysis: Instant scientific report on the detected object via Gemini.

[x] Full Docker Isolation: CORS configured communication between Frontend and Backend.

## 🗺 Roadmap

[ ] Leaflet Integration: Presenting images as a map layer.

[ ] Astroquery: Resolving real space coordinates (RA/Dec).

[ ] Custom Model: Training YOLO for real space objects (Galaxy, Nebula).

---
