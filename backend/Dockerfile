FROM python:3.10-slim

WORKDIR /app

# Sistem bağımlılıkları (OpenCV ve Astrometry için gerekli)
# libgl1-mesa-glx YERİNE libgl1 kullanıyoruz (Fix)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kodları kopyala
COPY . .

# Portu aç
EXPOSE 8000

# Uygulamayı başlat
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
