import { useState } from 'react'
import axios from 'axios'

// API Address (localhost:8001 since we access it from outside Docker)
const API_URL = "http://localhost:8001"

function App() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)

  // Log adding helper
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev])
  }

  // File Selection
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0])
    addLog(`File selected: ${e.target.files[0].name}`)
  }

  // Step 1: Send Image and Get YOLO Analysis
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setLoading(true)
    addLog("Starting YOLO scan...")
    
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const response = await axios.post(`${API_URL}/upload-and-detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const data = response.data
      setAnalysisResult(data)
      addLog(`Scan Completed! ${data.detections_found} objects found.`)
      console.log("YOLO Result:", data)

    } catch (error) {
      console.error(error)
      addLog(`ERROR: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Ask Gemini about the Selected Object
  const askGemini = async (detectionId, label) => {
    addLog(`Asking Gemini: ${label}...`)
    try {
      // Send request to backend endpoint
      const response = await axios.post(`${API_URL}/explain-detection/${detectionId}`)
      const text = response.data.description
      addLog(`GEMINI RESPONSE: ${text}`)
    } catch (error) {
      addLog(`Gemini Error: ${error.message}`)
    }
  }

  return (
    <div className="container">
      {/* LEFT PANEL: Controls and Logs */}
      <div className="sidebar">
        <h2>PARSEC VISION</h2>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "SCANNING..." : "START SCAN"}
          </button>
        </div>

        {/* DETECTION LIST */}
        {analysisResult && (
          <div>
            <h3>FINDINGS ({analysisResult.detections_found})</h3>
            {analysisResult.results.map((det, index) => (
              <div key={index} className="log-entry" style={{marginBottom: '5px'}}>
                <strong>{det.label}</strong> (%{det.confidence})
                <br/>
                {/* Since backend returns ID now, we can use it directly. 
                    (Comment updated during translation) */}
                <button 
                  style={{fontSize: '0.7rem', marginTop: '5px', background: det.id ? '#45a29e' : 'gray'}}
                  onClick={() => askGemini(det.id, det.label)}
                  disabled={!det.id}
                >
                  GEMINI ANALYSIS
                </button>
              </div>
            ))}
          </div>
        )}

        {/* LOG SCREEN */}
        <div style={{marginTop: 'auto'}}>
          <h3>SYSTEM LOGS</h3>
          {logs.map((log, i) => (
            <div key={i} className="log-entry">{log}</div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Map (Empty for now) */}
      <div className="map-area">
        <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}>
          <h1>MAP MODULE</h1>
          <p>Waiting for System Connection...</p>
        </div>
      </div>
    </div>
  )
}

export default App