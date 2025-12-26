# 🔧 Backend Geliştirici Notları

Burası **ParsecVision**'ın motor dairesidir. Kod yazarken aşağıdaki kurallara ve uyarılara dikkat edelim.

## 🚨 KRİTİK UYARILAR

1.  **Model Dosyası (`.pt`):**

    - `yolo11n.pt` dosyası `.gitignore` ile engellenmiştir.
    - Docker build sırasında internet yavaşsa indirme zaman aşımına uğrayabilir.
    - **Çözüm:** Modeli manuel indirip `backend/` kök dizinine atın. Kod, `/app/yolo11n.pt` yolunu kontrol edecek şekilde ayarlandı.

2.  **Veritabanı Şeması (Migration Yok!):**

    - Şu an Alembic kullanmıyoruz. `Base.metadata.create_all` ile tablolar otomatik oluşuyor.
    - **Uyarı:** `models.py` içinde bir tabloyu değiştirirseniz, Docker volume'ünü silmeden değişiklik yansımaz!
    - _DB Sıfırlama:_ `docker-compose down -v` (Veriler gider!)

3.  **VSCode & IntelliSense:**
    - Kod Docker'da çalışsa da, VSCode'un "kızarmaması" için yerel sanal ortam kurmalısınız:
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
    - _Not:_ Bu sadece editör içindir, çalıştırmak için Docker kullanın.

## 🔑 Environment (.env)

Backend'in çalışması için ana dizindeki `.env` dosyasında şu kesinlikle olmalı:

```ini
GEMINI_API_KEY=AIzaSy...
```

Yazmazsanız /analyze-text endpoint'i "API Key Eksik" hatası döner.

## 📡 API Test

Backend portu: 8001 (Eco Kitchen ile çakışmaması için 8000 değil!)

Docs: http://localhost:8001/docs

---
