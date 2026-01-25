# 🎨 Frontend Developer Notes

This is the cockpit of the project. We use Vite + React and Leaflet.

## ⚠️ THINGS TO PAY ATTENTION TO

1.  **Node Modules Trap:**
    - The `node_modules` folder is isolated on the Docker side (`/app/node_modules`).
    - Running `npm install` on your local machine is **only** for VSCode's code completion feature.
    - The application uses the packages inside Docker. If you add a new package, `docker-compose up --build` is required.

2.  **Space Map Logic (IMPORTANT):**
    - We do not use the standard World map (Lat/Lng)!
    - We use **L.CRS.Simple**. This is a pixel-based coordinate system starting from the [0,0] point.
    - YOLO coordinates (Top-Left) and Leaflet coordinates (Bottom-Left) might differ. Be careful when touching the conversion formulas in `App.jsx`.

3.  **API Connection:**
    - Backend address is hardcoded in the code: `const API_URL = "http://localhost:8001"`
    - If you change the backend port, don't forget to update this.

## 🚀 Development Tips

- Use CSS variables in `src/index.css` (`--text-color` etc.) for design. Avoid writing hardcoded colors.
- The log screen (`sidebar`) is only for debugging purposes, we won't show this much detail to the end user.

## 🐛 Common Issues

- **"Network Error":** Is the Backend (Port 8001) up? Is the CORS setting made in `main.py`?
- **Map Not Loading:** Is the image path (`/images/...`) correct? Is the Backend serving static files?
