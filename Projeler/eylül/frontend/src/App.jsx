import { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, ImageOverlay, Rectangle, useMap, Polyline, Tooltip, CircleMarker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const API_URL = "http://" + window.location.hostname + ":8001";

// Haritayı resme sığdıran ve eksi (-) butonunun kilitlenmesini çözen fonksiyon
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      // Leaflet'in varsayılan 0 sınırını ezip eksi tuşunu serbest bırakıyoruz
      map.setMinZoom(-50);
      
      // Layout shift (sağ panelin açılması vs) bittikten sonra haritayı ortala
      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [20, 20] });
      }, 150);
    }
  }, [bounds, map]);
  return null;
}

function App() {
  // Logları başlatırken önce Local Storage'a bakar, yoksa boş dizi döner
  const [logs, setLogs] = useState(() => {
    const savedLogs = localStorage.getItem("parsecVisionLogs");
    return savedLogs ? JSON.parse(savedLogs) : [];
  });

  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [cosmicExplanation, setCosmicExplanation] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("history");
  const [activeGalleryTab, setActiveGalleryTab] = useState("analyzed");
  const [historyData, setHistoryData] = useState([]);
  const [galleryData, setGalleryData] = useState([]);
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);
  
  const [imageFilters, setImageFilters] = useState({
    brightness: 100,
    contrast: 100,
    invert: 0
  });

  const resetFilters = () => {
    setImageFilters({ brightness: 100, contrast: 100, invert: 0 });
  };

  // Loglar her değiştiğinde Local Storage'ı günceller (Sayfa yenilense de loglar kalır)
  useEffect(() => {
    localStorage.setItem("parsecVisionLogs", JSON.stringify(logs));
  }, [logs]);

  // Eski analizlerin tarayıcıda kalmasını engellemek ve her açılışta/yeniden girişte ana ekranı sıfırlamak için temizlik
  useEffect(() => {
    const resetAll = () => {
      localStorage.removeItem("parsecVisionAnalysis");
      localStorage.removeItem("parsecVisionExplanation");
      setAnalysisResult(null);
      setCosmicExplanation(null);
      setSelectedFile(null);
    };

    resetAll();

    // Sayfa bfcache (geri/ileri önbelleği) veya sekme oturumu geri yüklendiğinde tetikle
    window.addEventListener("pageshow", resetAll);
    return () => {
      window.removeEventListener("pageshow", resetAll);
    };
  }, []);

  // Metni yaslayan ve **kalın** kısımları renklendiren fonksiyon
  const formatAnalysis = (text) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ color: "var(--highlight)" }}>
            {part.replace(/\*\*/g, "")}
          </strong>
        );
      }
      return part;
    });
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev]);
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/history`);
      setHistoryData(response.data.history);
    } catch (err) {
      addLog("Failed to fetch history.");
    }
  };

  const fetchGallery = async () => {
    try {
      const response = await axios.get(`${API_URL}/community-gallery`);
      setGalleryData(response.data.gallery);
    } catch (err) {
      addLog("Failed to fetch community gallery.");
    }
  };

  const loadHistoryItem = (item) => {
    setSelectedFile({ name: item.filename });
    setAnalysisResult({
      image_id: item.image_id,
      filename: item.filename,
      width: item.width || 1000,
      height: item.height || 1000,
      target_name: item.target_name,
      magnitude: item.magnitude,
      spectral_class: item.spectral_class,
      distance: item.distance,
      is_public: item.is_public,
      astrometry: { ra: item.ra || 0, dec: item.dec || 0 }
    });
    
    if (item.ai_analysis) {
      const rawText = item.ai_analysis;
      let cleanedText = rawText;
      try {
        const jsonStr = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed.detailed_analysis) {
          cleanedText = `**Region:** ${parsed.region_name}\n\n**Analysis:**\n${parsed.detailed_analysis}`;
        } else {
          cleanedText = `**Region:** ${parsed.region_name}\n\n**Note:** ${parsed.cosmic_note}`;
        }
        setAnalysisResult(prev => ({
          ...prev,
          key_features: parsed.key_features,
          cosmic_note: parsed.cosmic_note,
          detailed_analysis: parsed.detailed_analysis
        }));
      } catch (e) {
        cleanedText = rawText;
      }
      setCosmicExplanation(cleanedText);
    } else {
      setCosmicExplanation(null);
    }
    
    setIsHistoryOpen(false);
    addLog(`Loaded history: ${item.filename}`);
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    addLog("Generating PDF Report...");

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yOffset = 20;

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(0, 229, 255);
      doc.text("PARSEC VISION", pageWidth / 2, yOffset, { align: "center" });
      yOffset += 10;
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text("Astrometric Analysis Report", pageWidth / 2, yOffset, { align: "center" });
      yOffset += 15;

      // Target Name
      if (analysisResult?.target_name) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Target: ${analysisResult.target_name}`, 20, yOffset);
        yOffset += 8;
      }

      // Coordinates
      if (analysisResult?.astrometry) {
        doc.text(`RA: ${analysisResult.astrometry.ra.toFixed(4)}° | DEC: ${analysisResult.astrometry.dec.toFixed(4)}°`, 20, yOffset);
        yOffset += 15;
      }

      // Uploaded Image
      if (analysisResult?.image_id) {
        const imgUrl = `${API_URL}/${analysisResult.is_public ? 'gallery-images' : 'images'}/${analysisResult.image_id}.jpg`;
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        const base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        
        const maxImgWidth = 170;
        const imgProps = doc.getImageProperties(base64data);
        const imgRatio = imgProps.width / imgProps.height;
        const imgWidth = maxImgWidth;
        const imgHeight = maxImgWidth / imgRatio;

        if (yOffset + imgHeight > pageHeight - 20) {
          doc.addPage();
          yOffset = 20;
        }

        doc.addImage(base64data, "JPEG", 20, yOffset, imgWidth, imgHeight);
        yOffset += imgHeight + 15;
      }

      // AI Analysis
      if (analysisResult?.detailed_analysis) {
        if (yOffset > pageHeight - 40) { doc.addPage(); yOffset = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 229, 255);
        doc.text("AI Insights", 20, yOffset);
        yOffset += 10;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const splitText = doc.splitTextToSize(analysisResult.detailed_analysis, 170);
        for (let i = 0; i < splitText.length; i++) {
          if (yOffset > pageHeight - 15) {
            doc.addPage();
            yOffset = 20;
          }
          doc.text(splitText[i], 20, yOffset);
          yOffset += 6;
        }
        yOffset += 5;
      }



      doc.save(`ParsecVision_Report.pdf`);
      addLog("Report exported successfully.");

    } catch (error) {
      console.error(error);
      addLog("ERROR: Failed to generate PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setAnalysisResult(null);
    setCosmicExplanation(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("is_public", 0);
      const response = await axios.post(
        `${API_URL}/upload-and-detect`,
        formData,
      );
      setAnalysisResult(response.data);
      addLog(`Scan complete.`);
    } catch (error) {
      addLog(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryUpload = async (file) => {
    if (!file) return;
    addLog(`Uploading raw image to Pool: ${file.name}`);
    setIsGalleryUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await axios.post(`${API_URL}/upload-raw`, formData);
      addLog(`Raw upload complete.`);
      fetchGallery(); // Refresh gallery
    } catch (error) {
      addLog(`ERROR: ${error.message}`);
    } finally {
      setIsGalleryUploading(false);
    }
  };

  const handleAnalyzeExisting = async (item) => {
    setIsGalleryOpen(false);
    setSelectedFile({ name: item.filename });
    setLoading(true);
    setAnalysisResult(null);
    setCosmicExplanation(null);
    try {
      const response = await axios.post(`${API_URL}/analyze-existing/${item.image_id}`);
      setAnalysisResult(response.data);
      addLog(`Scan complete from gallery pool.`);
      fetchHistory();
      fetchGallery();
    } catch (error) {
      addLog(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const askGeminiCosmic = async (ra, dec) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setCosmicExplanation("Querying deep space database...");

    const validRa = (typeof ra === 'number') ? ra : (parseFloat(ra) || 0.0);
    const validDec = (typeof dec === 'number') ? dec : (parseFloat(dec) || 0.0);

    try {
      const response = await axios.post(`${API_URL}/analyze-cosmic`, {
        ra: validRa,
        dec: validDec,
        image_id: analysisResult?.image_id,
      });

      let rawText = response.data.analysis;
      let cleanedText = rawText;

      try {
        // AI'dan gelen yeni JSON formatını ayrıştırmayı dene
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        if (parsed.detailed_analysis) {
          cleanedText = `**Region:** ${parsed.region_name}\n\n**Analysis:**\n${parsed.detailed_analysis}`;
        } else {
          cleanedText = `**Region:** ${parsed.region_name}\n\n**Note:** ${parsed.cosmic_note}`;
        }
        
        // AI'dan gelen detayları haritadaki kutu (modal) için de kaydet
        setAnalysisResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            key_features: parsed.key_features,
            cosmic_note: parsed.cosmic_note,
            detailed_analysis: parsed.detailed_analysis,
            anomaly_scores: parsed.anomaly_scores,
          };
        });
      } catch (e) {
        // Eski metin formatı geldiyse
        cleanedText = rawText.replace(
          /Thank you for uploading your image to ParsecVision\.?\s*/i,
          ""
        );
      }

      setCosmicExplanation(cleanedText);
    } catch (error) {
      setCosmicExplanation(
        error.response?.status === 429 ? "Quota exceeded." : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container">
      <header className="top-header">
        <h1>PARSEC VISION</h1>
        <div style={{ color: "var(--highlight)", fontSize: "1.1rem", letterSpacing: "2px", fontWeight: "300" }}>
          {analysisResult?.astrometry
            ? "TARGET: DEEP SPACE OBJECT 🌌✨🪐"
            : "SYSTEM: AWAITING TELEMETRY 📡"}
        </div>
        <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
          <button 
            className="icon-button"
            onClick={() => {
              fetchGallery();
              setIsGalleryOpen(true);
            }} 
            style={{ 
              fontSize: "0.9rem", 
              padding: "8px 20px", 
              background: "rgba(0, 229, 255, 0.15)", 
              color: "var(--highlight)", 
              border: "1px solid var(--highlight)", 
              cursor: "pointer", 
              borderRadius: "20px", 
              fontWeight: "bold",
              boxShadow: "0 0 10px rgba(0, 229, 255, 0.2)"
            }}
          >
            ✧ COMMUNITY GALLERY
          </button>
          <button 
            className="icon-button"
            onClick={() => {
              fetchHistory();
              setIsHistoryOpen(true);
              setActiveModalTab("history");
            }} 
            style={{ fontSize: "1.5rem", padding: "0", background: "transparent", border: "none", cursor: "pointer", color: "var(--highlight)" }}
            title="Menu (History & Logs)"
          >
            ☰
          </button>
        </div>
      </header>

      <div className="sidebar">
        <div className="file-upload-container">
          <input
            type="file"
            id="fileInput"
            onChange={(e) => {
              setSelectedFile(e.target.files[0]);
              addLog(`File: ${e.target.files[0].name}`);
            }}
            style={{ display: "none" }}
          />
          <label htmlFor="fileInput" className="custom-file-upload">
            {selectedFile ? selectedFile.name : "CHOOSE FILE"}
          </label>
        </div>
        <button 
          onClick={handleUpload} 
          disabled={loading || !selectedFile}
          style={(!selectedFile && !loading) ? { opacity: 0.5, cursor: "not-allowed" } : {}}
        >
          {loading ? "SCANNING..." : "START SCAN"}
        </button>


        {analysisResult?.astrometry && (
          <div
            className="celestial-box"
            style={{
              marginTop: "20px",
              border: "1px solid rgba(0, 229, 255, 0.25)",
              borderRadius: "12px",
              background: "rgba(10, 15, 25, 0.3)",
              padding: "15px",
            }}
          >
            <h4>CELESTIAL DATA</h4>
            <p>
              RA: {analysisResult.astrometry.ra?.toFixed(4) || "N/A"}° | DEC:{" "}
              {analysisResult.astrometry.dec?.toFixed(4) || "N/A"}°
            </p>
            <button
              disabled={isAnalyzing}
              onClick={() =>
                askGeminiCosmic(
                  analysisResult.astrometry.ra,
                  analysisResult.astrometry.dec,
                )
              }
            >
              {isAnalyzing ? "ANALYZING..." : "ANALYZE REGION"}
            </button>
          </div>
        )}

        {analysisResult && (
          <div
            className="celestial-box"
            style={{
              marginTop: "20px",
              border: "1px solid rgba(0, 229, 255, 0.25)",
              borderRadius: "12px",
              background: "rgba(10, 15, 25, 0.3)",
              padding: "15px",
              textAlign: "left"
            }}
          >
            <h4 style={{ margin: "0 0 15px 0" }}>IMAGE CONTROLS</h4>
            
            <label style={{ fontSize: "0.8rem", color: "#ccc", display: "block", marginBottom: "5px" }}>
              Brightness: {imageFilters.brightness}%
            </label>
            <input 
              type="range" 
              min="0" max="200" 
              value={imageFilters.brightness} 
              onChange={(e) => setImageFilters(prev => ({ ...prev, brightness: e.target.value }))}
              style={{ width: "100%", marginBottom: "15px" }}
            />

            <label style={{ fontSize: "0.8rem", color: "#ccc", display: "block", marginBottom: "5px" }}>
              Contrast: {imageFilters.contrast}%
            </label>
            <input 
              type="range" 
              min="0" max="300" 
              value={imageFilters.contrast} 
              onChange={(e) => setImageFilters(prev => ({ ...prev, contrast: e.target.value }))}
              style={{ width: "100%", marginBottom: "15px" }}
            />

            <label style={{ fontSize: "0.8rem", color: "#ccc", display: "block", marginBottom: "5px" }}>
              Invert: {imageFilters.invert}%
            </label>
            <input 
              type="range" 
              min="0" max="100" 
              value={imageFilters.invert} 
              onChange={(e) => setImageFilters(prev => ({ ...prev, invert: e.target.value }))}
              style={{ width: "100%", marginBottom: "15px" }}
            />

            <button 
              onClick={resetFilters}
              style={{ padding: "8px", fontSize: "0.8rem", borderColor: "rgba(255,255,255,0.3)", color: "#ccc" }}
            >
              RESET FILTERS
            </button>
          </div>
        )}

        {/* LOGS REMOVED FROM SIDEBAR */}
      </div>

      {/* DİNAMİK FİLTRE CSS'İ (Doğrudan DOM'a gömülüyor) */}
      <style>
        {`
          .leaflet-image-layer, .astronomy-image {
            filter: brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%) invert(${imageFilters.invert}%) !important;
            transition: filter 0.1s ease-out;
          }
        `}
      </style>

      <div className="map-area" id="export-map-area">
        {analysisResult ? (
          <MapContainer
            key={analysisResult.image_id}
            className="leaflet-container"
            crs={L.CRS.Simple}
            style={{ height: "100%", width: "100%" }}
            minZoom={-20}
            maxZoom={10}
            zoomSnap={0.5}
            wheelPxPerZoomLevel={120}
          >
            <ImageOverlay
              url={`${API_URL}/${analysisResult.is_public ? 'gallery-images' : 'images'}/${analysisResult.image_id}.${analysisResult.filename ? analysisResult.filename.split('.').pop() : 'jpg'}`}
              bounds={[
                [0, 0],
                [analysisResult.height, analysisResult.width],
              ]}
              className="astronomy-image"
            />
            <FitBounds
              bounds={[
                [0, 0],
                [analysisResult.height, analysisResult.width],
              ]}
            />
            
            {/* YENİ AKILLI ANA ÇERÇEVE */}
            <Rectangle
              bounds={[
                [0, 0],
                [analysisResult.height, analysisResult.width],
              ]}
              pathOptions={{
                color: "var(--highlight)",
                weight: 3,
                fillColor: "#00e5ff",
                fillOpacity: 0,
              }}
              className="frame-glow-effect"
              eventHandlers={{
                mouseover: (e) =>
                  e.target.setStyle({
                    color: "#ffffff",
                    weight: 4,
                    fillOpacity: 0.1,
                  }),
                mouseout: (e) =>
                  e.target.setStyle({
                    color: "var(--highlight)",
                    weight: 3,
                    fillOpacity: 0,
                  }),
                click: () => {
                  // ARTIK VERİLER SABİT DEĞİL, DİNAMİK OLARAK BACKEND'DEN (analysisResult) BEKLENİYOR
                  // App.jsx -> handleUpload veya analyze fonksiyonun içindeki kısım
                  // Backend'den gelen `target_name`, `magnitude` gibi alanları doğrudan alıyoruz:
                  const raStr = typeof analysisResult.astrometry?.ra === 'number' ? `${analysisResult.astrometry.ra.toFixed(4)}°` : "N/A°";
                  const decStr = typeof analysisResult.astrometry?.dec === 'number' ? `${analysisResult.astrometry.dec.toFixed(4)}°` : "N/A°";

                  setSelectedDetail({
                    coordinates: `${raStr}, ${decStr}`,
                    target: analysisResult.target_name || "Unknown Object",
                    magnitude: analysisResult.magnitude || "N/A",
                    spectralClass: analysisResult.spectral_class || "N/A",
                    distance: analysisResult.distance || "N/A",
                    keyFeatures: analysisResult.key_features,
                    cosmicNote: analysisResult.cosmic_note,
                    anomalyScores: analysisResult.anomaly_scores,
                    confidence: analysisResult.confidence
                      ? `${(analysisResult.confidence * 100).toFixed(1)}%`
                      : "Awaiting...",
                  });
                  setIsModalOpen(true);
                },
              }}
            />
          </MapContainer>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "var(--highlight)",
            }}
          >
            <h2>PARSEC VISION MODULE READY</h2>
          </div>
        )}
      </div>

      {/* YENİ SAĞ PANEL (AI INSIGHTS) - SADECE 'ANALYZE REGION' TIKLANDIKTAN SONRA GÖRÜNÜR */}
      {analysisResult && cosmicExplanation && (
        <div className="right-panel">
          <h3 style={{ color: "var(--highlight)", marginTop: 0, marginBottom: "20px", letterSpacing: "1px" }}>AI INSIGHT</h3>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Styled Region Header Card */}
            <div style={{
              background: "rgba(0, 229, 255, 0.05)",
              border: "1px solid rgba(0, 229, 255, 0.15)",
              borderRadius: "8px",
              padding: "12px 15px",
              marginBottom: "15px"
            }}>
              <span style={{
                color: "var(--highlight)",
                fontSize: "0.75rem",
                fontWeight: "bold",
                letterSpacing: "1.5px",
                textTransform: "uppercase"
              }}>
                Region / Target
              </span>
              <div style={{
                fontSize: "1.1rem",
                fontWeight: "700",
                marginTop: "4px",
                color: "#fff"
              }}>
                {analysisResult.target_name || "Deep Space Region"}
              </div>
            </div>

            {/* Structured Analysis Content */}
            <div className="cosmic-explanation" style={{ flexGrow: 1, overflowY: "auto", paddingRight: "10px", marginTop: 0 }}>
              <span style={{
                color: "var(--highlight)",
                fontSize: "0.75rem",
                fontWeight: "bold",
                letterSpacing: "1.5px",
                display: "block",
                marginBottom: "10px",
                textTransform: "uppercase"
              }}>
                Detailed Analysis
              </span>
              {formatAnalysis(
                cosmicExplanation
                  .replace(/^\*\*Region:\*\*.*?\n+/i, "")
                  .replace(/^\*\*Analysis:\*\*\n+/i, "")
                  .replace(/^Region:.*?\n+/i, "")
                  .replace(/^Analysis:\n+/i, "")
                  .trim()
              )}
            </div>
            <button 
              onClick={exportToPDF} 
              disabled={isExporting}
              style={{ marginTop: "20px", borderColor: "#fff", color: "#fff", flexShrink: 0 }}
            >
              {isExporting ? "GENERATING PDF..." : "EXPORT REPORT"}
            </button>
          </div>
        </div>
      )}

      {/* BİLİMSEL MODAL (BİLGİ KUTUSU) TASARIMI */}
      {isModalOpen && selectedDetail && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Astrometric Analysis</h2>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <span
                  style={{
                    color: "var(--highlight)",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                    letterSpacing: "1.5px",
                  }}
                >
                  TARGET
                </span>
                <p
                  style={{
                    margin: "5px 0 0 0",
                    fontSize: "1.2rem",
                    fontWeight: "300",
                  }}
                >
                  {selectedDetail.target}
                </p>
              </div>

              {/* EĞER BİR "AI INSIGHT" İSE ÖZEL BİR KUTU GÖSTER */}
              {selectedDetail.keyFeatures && (
                <div
                  style={{
                    background: "rgba(0, 229, 255, 0.1)",
                    padding: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <h4 style={{ color: "#00e5ff", margin: "0 0 10px 0" }}>
                    KEY FEATURES
                  </h4>
                  <ul style={{ paddingLeft: "0", fontSize: "0.9rem", listStylePosition: "inside" }}>
                    {selectedDetail.keyFeatures.split(",").map((f, i) => (
                      <li key={i}>{f.trim()}</li>
                    ))}
                  </ul>
                  <p
                    style={{
                      fontStyle: "italic",
                      fontSize: "0.85rem",
                      marginTop: "10px",
                    }}
                  >
                    {selectedDetail.cosmicNote}
                  </p>
                </div>
              )}

              {/* --- MAGNITUDE, SPECTRAL CLASS, DISTANCE, COORDINATES --- */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  borderBottom: "1px solid rgba(0, 229, 255, 0.2)",
                  paddingBottom: "10px",
                }}
              >
                {/* Sadece veri varsa render et */}
                {selectedDetail.magnitude !== "N/A" && (
                  <div>
                    <span
                      style={{
                        color: "var(--highlight)",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        letterSpacing: "1.5px",
                      }}
                    >
                      MAGNITUDE
                    </span>
                    <p
                      style={{
                        margin: "5px 0 0 0",
                        fontSize: "1.2rem",
                        fontWeight: "300",
                      }}
                    >
                      {selectedDetail.magnitude}
                    </p>
                  </div>
                )}

                {selectedDetail.spectralClass !== "N/A" && (
                  <div>
                    <span
                      style={{
                        color: "var(--highlight)",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        letterSpacing: "1.5px",
                      }}
                    >
                      SPECTRAL CLASS
                    </span>
                    <p
                      style={{
                        margin: "5px 0 0 0",
                        fontSize: "1.2rem",
                        fontWeight: "300",
                      }}
                    >
                      {selectedDetail.spectralClass}
                    </p>
                  </div>
                )}

                {selectedDetail.distance !== "N/A" &&
                  selectedDetail.distance !== "AI Analysis" && (
                    <div>
                      <span
                        style={{
                          color: "var(--highlight)",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          letterSpacing: "1.5px",
                        }}
                      >
                        DISTANCE (Est.)
                      </span>
                      <p
                        style={{
                          margin: "5px 0 0 0",
                          fontSize: "1.2rem",
                          fontWeight: "300",
                        }}
                      >
                        {selectedDetail.distance}
                      </p>
                    </div>
                  )}

                {/* Koordinatlar her zaman var, o yüzden onları gizlemiyoruz */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <span
                    style={{
                      color: "var(--highlight)",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      letterSpacing: "1.5px",
                    }}
                  >
                    COORDINATES
                  </span>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      fontSize: "1.2rem",
                      fontWeight: "300",
                    }}
                  >
                    {selectedDetail.coordinates}
                  </p>
                </div>
              </div>

              {/* DİNAMİK YAPAY ZEKA GÜVEN SKORU */}
              {selectedDetail.anomalyScores && (
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(0, 229, 255, 0.2)", paddingTop: "15px" }}>
                  <span
                    style={{
                      color: "var(--highlight)",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      letterSpacing: "1.5px",
                      display: "block",
                      marginBottom: "15px"
                    }}
                  >
                    AI CONFIDENCE SCORES
                  </span>
                  
                  {Object.entries(selectedDetail.anomalyScores).map(([label, score]) => (
                    <div key={label} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#ccc", marginBottom: "4px", fontWeight: "bold" }}>
                        <span>{label}</span>
                        <span style={{ color: label === "Artifact" ? "#ff4444" : "var(--highlight)" }}>{score}%</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ 
                          width: `${score}%`, 
                          height: "100%", 
                          background: label === "Artifact" ? "linear-gradient(90deg, #ff0000, #ff4444)" : "linear-gradient(90deg, #0088ff, #00e5ff)", 
                          transition: "width 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" 
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {isHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", padding: "20px" }}>
            
            {/* TABS */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", borderBottom: "1px solid rgba(0,229,255,0.3)", paddingBottom: "10px" }}>
              <h2 
                style={{ cursor: "pointer", color: activeModalTab === "history" ? "var(--highlight)" : "#555", margin: 0 }}
                onClick={() => setActiveModalTab("history")}
              >
                SCAN HISTORY
              </h2>
              <h2 
                style={{ cursor: "pointer", color: activeModalTab === "logs" ? "var(--highlight)" : "#555", margin: 0 }}
                onClick={() => setActiveModalTab("logs")}
              >
                SYSTEM LOGS
              </h2>
            </div>

            {/* HISTORY TAB */}
            {activeModalTab === "history" && (
              historyData.length === 0 ? (
                <p>No past scans found.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", maxHeight: "50vh", overflowY: "auto", paddingRight: "10px" }}>
                  {historyData.map(item => (
                    <div 
                      key={item.image_id} 
                      style={{ 
                        border: "1px solid rgba(0,229,255,0.2)", 
                        borderRadius: "8px", 
                        padding: "15px", 
                        cursor: "pointer",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        textAlign: "left"
                      }}
                      onClick={() => {
                        loadHistoryItem(item);
                        setIsHistoryOpen(false);
                      }}
                    >
                      <img 
                        src={`${API_URL}/${item.is_public ? 'gallery-images' : 'images'}/${item.image_id}.${item.filename ? item.filename.split('.').pop() : 'jpg'}`} 
                        alt={item.target_name} 
                        style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "4px", marginBottom: "10px" }}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; e.target.style.background = '#0a0f1e'; }}
                      />
                      <h4 style={{ margin: "0 0 10px 0", color: "#fff" }}>{item.target_name === "Unknown Deep Space Object" ? "Deep Space Object" : item.target_name}</h4>
                      <p style={{ margin: "0 0 5px 0", fontSize: "0.8rem", color: "#aaa" }}>Date: {new Date(item.uploaded_at).toLocaleString()}</p>
                      <p style={{ margin: "0 0 5px 0", fontSize: "0.8rem", color: "#aaa" }}>File: {item.filename}</p>
                      {item.ai_analysis && <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--highlight)" }}>✓ AI Analysis Saved</p>}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* LOGS TAB */}
            {activeModalTab === "logs" && (
              <div style={{ maxHeight: "50vh", overflowY: "auto", textAlign: "left", paddingRight: "10px" }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #222", padding: "8px 0", fontSize: "0.85rem", color: "#ccc", fontFamily: "monospace" }}>
                    {log}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setIsHistoryOpen(false)} style={{ marginTop: "20px" }}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* COMMUNITY GALLERY MODAL */}
      {isGalleryOpen && (
        <div className="modal-overlay" onClick={() => setIsGalleryOpen(false)}>
          <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h2 className="modal-title" style={{ margin: 0, color: "var(--highlight)", textAlign: "center" }}>✧ COMMUNITY GALLERY</h2>
              <button 
                onClick={() => setIsGalleryOpen(false)} 
                style={{ padding: "8px 20px", margin: 0, background: "transparent", border: "1px solid var(--highlight)", borderRadius: "20px", width: "auto" }}
              >
                CLOSE
              </button>
            </div>
            {/* GALLERY TABS */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", borderBottom: "1px solid rgba(0,229,255,0.3)", paddingBottom: "10px" }}>
              <h2 
                style={{ cursor: "pointer", color: activeGalleryTab === "analyzed" ? "var(--highlight)" : "#555", margin: 0 }}
                onClick={() => setActiveGalleryTab("analyzed")}
              >
                DISCOVERIES (ANALYZED)
              </h2>
              <h2 
                style={{ cursor: "pointer", color: activeGalleryTab === "raw" ? "var(--highlight)" : "#555", margin: 0 }}
                onClick={() => setActiveGalleryTab("raw")}
              >
                RAW IMAGE POOL
              </h2>
            </div>

            {activeGalleryTab === "analyzed" && (
              <p style={{ color: "#aaa", marginTop: 0, marginBottom: "20px" }}>Explore the most recent celestial discoveries analyzed by the community.</p>
            )}

            <div className="gallery-grid">
              {activeGalleryTab === "raw" && (
                /* UPLOAD CARD */
                <div 
                  className="gallery-card" 
                  style={{ 
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    background: isGalleryUploading ? "rgba(0, 229, 255, 0.15)" : "rgba(0, 229, 255, 0.05)", 
                    border: "2px dashed var(--highlight)",
                    cursor: isGalleryUploading ? "wait" : "pointer"
                  }}
                  onClick={() => { if (!isGalleryUploading) document.getElementById('galleryFileInput').click(); }}
                >
                  <input
                    type="file"
                    id="galleryFileInput"
                    onChange={(e) => {
                      handleGalleryUpload(e.target.files[0]);
                      e.target.value = null;
                    }}
                    style={{ display: "none" }}
                    disabled={isGalleryUploading}
                  />
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    {isGalleryUploading ? (
                      <>
                        <div className="loading-spinner" style={{ margin: "0 auto 15px", width: "30px", height: "30px", border: "3px solid rgba(0, 229, 255, 0.3)", borderTopColor: "var(--highlight)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                        <h3 style={{ color: "var(--highlight)", letterSpacing: "1px", margin: "0 0 10px 0" }}>UPLOADING...</h3>
                        <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>Saving raw image to pool...</p>
                      </>
                    ) : (
                      <>
                        <h3 style={{ color: "var(--highlight)", letterSpacing: "1px", margin: "0 0 10px 0" }}>+ ADD RAW IMAGE</h3>
                        <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>Add unanalyzed deep space images to the community pool.</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {galleryData.length > 0 && galleryData
                .filter(item => activeGalleryTab === "analyzed" ? item.is_analyzed === 1 : item.is_analyzed === 0)
                .filter((item, index, self) => 
                  // Benzersiz resimleri tespit et (ID, filename, koordinatlar veya ID-filename eşleşmesi ile)
                  index === self.findIndex((t) => (
                    t.image_id === item.image_id ||
                    t.filename === item.filename ||
                    (t.ra !== null && t.ra !== undefined && t.ra === item.ra && t.dec !== null && t.dec !== undefined && t.dec === item.dec) ||
                    t.filename.startsWith(item.image_id) ||
                    item.filename.startsWith(t.image_id)
                  ))
                )
                .map(item => (
                <div 
                    key={item.image_id} 
                    className="gallery-card"
                    onClick={() => {
                      if (item.is_analyzed === 0) {
                        handleAnalyzeExisting(item);
                      } else {
                        loadHistoryItem(item);
                        setIsGalleryOpen(false);
                      }
                    }}
                  >
                    <img 
                      src={`${API_URL}/${item.is_public ? 'gallery-images' : 'images'}/${item.image_id}.${item.filename ? item.filename.split('.').pop() : 'jpg'}`} 
                      alt={item.target_name === "Unknown Deep Space Object" ? "Deep Space Object" : item.target_name} 
                      className="gallery-card-img" 
                      style={{ height: "200px", borderBottom: "none" }}
                      onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; e.target.style.background = '#0a0f1e'; }}
                    />
                  </div>
                ))}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
