import { useState } from 'react'
import axios from 'axios'
import { MapContainer, ImageOverlay, Rectangle, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API_URL = "http://localhost:8001"

function App() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [cosmicExplanation, setCosmicExplanation] = useState(null)

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev])
  }

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0])
    addLog(`File selected: ${e.target.files[0].name}`)
  }

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setLoading(true)
    setAnalysisResult(null)
    setCosmicExplanation(null)
    addLog("Starting Scan...")
    
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const response = await axios.post(`${API_URL}/upload-and-detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const data = response.data
      setAnalysisResult(data)
      addLog(`Scan Completed! ${data.detections_found} objects found.`)

    } catch (error) {
      addLog(`ERROR: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const askGemini = async (detectionId, label) => {
    addLog(`Querying Gemini for: ${label}...`)
    try {
      const response = await axios.post(`${API_URL}/explain-detection/${detectionId}`)
      addLog(`GEMINI RESPONSE: ${response.data.description}`)
    } catch (error) {
      addLog(`Gemini Error: ${error.message}`)
    }
  }

  const askGeminiCosmic = async (ra, dec) => {
    addLog(`Requesting cosmic analysis: RA ${ra}, Dec ${dec}`)
    setCosmicExplanation("Gemini analysis in progress...")
    
    try {
      const response = await axios.post(`${API_URL}/analyze-cosmic`, { ra, dec })
      setCosmicExplanation(response.data.analysis)
      addLog("Cosmic analysis completed.")
    } catch (error) {
      addLog(`Cosmic Analysis Error: ${error.message}`)
      setCosmicExplanation("Failed to perform analysis.")
    }
  }

  return (
    <div className="container">
      <div className="sidebar">
        <h2>PARSEC VISION</h2>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "SCANNING..." : "START SCAN"}
          </button>
        </div>

        {analysisResult && analysisResult.astrometry && (
          <div style={{
            border: '1px solid var(--text-color)', 
            padding: '10px', 
            background: 'rgba(102, 252, 241, 0.1)',
            marginTop: '20px'
          }}>
            <h3 style={{marginTop: 0, color: 'var(--text-color)'}}>
              🌌 CELESTIAL WCS SOLUTION
            </h3>
            
            {analysisResult.astrometry.status === "success" ? (
              <div>
                <p style={{margin: '5px 0'}}>
                  <strong>RIGHT ASCENSION (RA):</strong> {analysisResult.astrometry.ra}°
                </p>
                <p style={{margin: '5px 0'}}>
                  <strong>DECLINATION (Dec):</strong> {analysisResult.astrometry.dec}°
                </p>
                <button 
                  style={{fontSize: '0.7rem', marginTop: '10px', width: '100%'}}
                  onClick={() => askGeminiCosmic(analysisResult.astrometry.ra, analysisResult.astrometry.dec)}
                >
                  ANALYZE REGION WITH GEMINI
                </button>
                
                {cosmicExplanation && (
                  <div style={{marginTop: '10px', fontSize: '0.8rem', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid #45a29e'}}>
                    {cosmicExplanation}
                  </div>
                )}
              </div>
            ) : (
              <p style={{color: '#ff4d4d', margin: 0, fontSize: '0.9rem'}}>
                Coordinates could not be solved. (Deep space images only.)
              </p>
            )}
          </div>
        )}

        {analysisResult && (
          <div style={{marginTop: '20px'}}>
            <h3>FINDINGS ({analysisResult.detections_found})</h3>
            {analysisResult.results.map((det) => (
              <div key={det.id} className="log-entry" style={{marginBottom: '5px'}}>
                <strong>{det.label}</strong> ({(det.confidence * 100).toFixed(1)}%)
                <br/>
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

        <div style={{marginTop: 'auto', paddingTop: '20px'}}>
          <h3>SYSTEM LOGS</h3>
          {logs.map((log, i) => (
            <div key={i} className="log-entry">{log}</div>
          ))}
        </div>
      </div>

      <div className="map-area">
        {!analysisResult ? (
          <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center'}}>
            <h2>MAP MODULE</h2>
            <p>Waiting for System Connection...</p>
          </div>
        ) : (
          <MapContainer 
            center={[analysisResult.height / 2, analysisResult.width / 2]} 
            zoom={0} 
            crs={L.CRS.Simple} 
            style={{ height: "100%", width: "100%", background: '#0b0c10' }}
            scrollWheelZoom={true}
          >
            <ImageOverlay
              url={`${API_URL}/images/${analysisResult.image_id}.${selectedFile.name.split('.').pop()}`}
              bounds={[[0, 0], [analysisResult.height, analysisResult.width]]}
            />

            {analysisResult.results.map((det) => (
              <Rectangle
                key={det.id}
                bounds={[
                  [analysisResult.height - det.box.y - det.box.h, det.box.x],
                  [analysisResult.height - det.box.y, det.box.x + det.box.w]
                ]}
                pathOptions={{ color: '#66fcf1', weight: 2, fillOpacity: 0.1 }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                  {det.label} ({(det.confidence * 100).toFixed(1)}%)
                </Tooltip>
              </Rectangle>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  )
}

export default App
