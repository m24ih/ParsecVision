# 🎨 Frontend Geliştirici Notları

Burası projenin kokpiti. Vite + React ve Leaflet kullanıyoruz.

## ⚠️ DİKKAT EDİLMESİ GEREKENLER

1.  **Node Modules Tuzağı:**
    * `node_modules` klasörü Docker tarafında izole edilmiştir (`/app/node_modules`).
    * Yerel makinenizde `npm install` yapmanız **sadece** VSCode'un kod tamamlama özelliği içindir.
    * Uygulama, Docker'ın içindeki paketleri kullanır. Yeni paket eklerseniz `docker-compose up --build` şarttır.

2.  **Uzay Haritası Mantığı (ÖNEMLİ):**
    * Standart Dünya haritası (Lat/Lng) kullanmıyoruz!
    * **L.CRS.Simple** kullanıyoruz. Bu, [0,0] noktasından başlayan piksel bazlı bir koordinat sistemidir.
    * YOLO koordinatları (Sol-Üst) ile Leaflet koordinatları (Sol-Alt) farklı olabilir. `App.jsx` içindeki dönüşüm formüllerine dokunurken dikkatli olun.

3.  **API Bağlantısı:**
    * Backend adresi kod içinde sabitlenmiştir: `const API_URL = "http://localhost:8001"`
    * Eğer backend portunu değiştirirseniz burayı güncellemeyi unutmayın.

## 🚀 Geliştirme İpuçları
* Tasarım için `src/index.css` içindeki CSS değişkenlerini (`--text-color` vb.) kullanın. Hardcode renk yazmaktan kaçının.
* Log ekranı (`sidebar`) sadece debug amaçlıdır, son kullanıcıya bu kadar detay göstermeyeceğiz.

## 🐛 Sık Karşılaşılan Sorunlar
* **"Network Error":** Backend (Port 8001) ayakta mı? CORS ayarı `main.py` içinde yapılı mı?
* **Harita Yüklenmiyor:** Resim yolu (`/images/...`) doğru mu? Backend statik dosyaları sunuyor mu?