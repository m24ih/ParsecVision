import { useState } from 'react'
import axios from 'axios'

// API Adresi (Docker dışından eriştiğimiz için localhost:8001)
const API_URL = "http://localhost:8001"

function App() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)

  // Log ekleme yardımcısı
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev])
  }

  // Dosya Seçimi
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0])
    addLog(`Dosya seçildi: ${e.target.files[0].name}`)
  }

  // 1. Adım: Görüntüyü Gönder ve YOLO Analizi Al
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setLoading(true)
    addLog("YOLO taraması başlatılıyor...")
    
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const response = await axios.post(`${API_URL}/upload-and-detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const data = response.data
      setAnalysisResult(data)
      addLog(`Tarama Tamamlandı! ${data.detections_found} nesne bulundu.`)
      console.log("YOLO Sonucu:", data)

    } catch (error) {
      console.error(error)
      addLog(`HATA: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 2. Adım: Seçilen Nesneyi Gemini'ye Sor
  const askGemini = async (detectionId, label) => {
    addLog(`Gemini'ye soruluyor: ${label}...`)
    try {
      // Backend'deki endpoint'e istek at
      const response = await axios.post(`${API_URL}/explain-detection/${detectionId}`)
      const text = response.data.description
      addLog(`GEMINI YANITI: ${text}`)
    } catch (error) {
      addLog(`Gemini Hatası: ${error.message}`)
    }
  }

  return (
    <div className="container">
      {/* SOL PANEL: Kontrol ve Loglar */}
      <div className="sidebar">
        <h2>PARSEC VISION</h2>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "TARANIYOR..." : "TARAMAYI BAŞLAT"}
          </button>
        </div>

        {/* TESPİT LİSTESİ */}
        {analysisResult && (
          <div>
            <h3>BULGULAR ({analysisResult.detections_found})</h3>
            {analysisResult.results.map((det, index) => (
              <div key={index} className="log-entry" style={{marginBottom: '5px'}}>
                <strong>{det.label}</strong> (%{det.confidence})
                <br/>
                {/* Şimdilik ID'yi backend döndürmediği için dummy ID kullanıyoruz, 
                    sonraki adımda bunu düzelteceğiz. */}
                <button 
                  style={{fontSize: '0.7rem', marginTop: '5px', background: det.id ? '#45a29e' : 'gray'}}
                  onClick={() => askGemini(det.id, det.label)}
                  disabled={!det.id}
                >
                  GEMINI ANALİZİ
                </button>
              </div>
            ))}
          </div>
        )}

        {/* LOG EKRANI */}
        <div style={{marginTop: 'auto'}}>
          <h3>SİSTEM LOGLARI</h3>
          {logs.map((log, i) => (
            <div key={i} className="log-entry">{log}</div>
          ))}
        </div>
      </div>

      {/* SAĞ PANEL: Harita (Şimdilik Boş) */}
      <div className="map-area">
        <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}>
          <h1>HARİTA MODÜLÜ</h1>
          <p>Sistem Bağlantısı Bekleniyor...</p>
        </div>
      </div>
    </div>
  )
}

export default App