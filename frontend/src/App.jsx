import React, { useState } from 'react';
import { MapContainer, ImageOverlay, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const App = () => {
  const [detections, setDetections] = useState([
    { id: 1, name: "Sirius", coords: [500, 500], distance: "8.6 ly", info: "Alpha Canis Majoris" }
  ]);

  // Görüntü boyutlarına göre koordinat sistemi (CRS.Simple)
  const bounds = [[0, 0], [1000, 1000]];

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <h1 style={{ position: "absolute", zIndex: 1000, color: "white", left: "20px" }}>ParsecVision</h1>
      
      <MapContainer 
        crs={L.CRS.Simple} 
        bounds={bounds} 
        style={{ height: "100%", background: "#000" }}
      >
        {/* Kullanıcının yüklediği görsel buraya gelecek */}
        <ImageOverlay
          url="https://imgsrc.hubblesite.org/hvi/uploads/image_file/image_attachment/31154/STSCI-H-p2012a-m-2000x2000.jpg"
          bounds={bounds}
        />

        {detections.map((obj) => (
          <Marker 
            key={obj.id} 
            position={obj.coords}
            eventHandlers={{
              mouseover: (e) => e.target.openPopup(),
            }}
          >
            <Popup>
              <strong>{obj.name}</strong><br/>
              Uzaklık: {obj.distance}<br/>
              Analiz: {obj.info}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default App;