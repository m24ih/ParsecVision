import os
import time
from google import genai

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            print("WARNING: GEMINI_API_KEY not found. AI analysis will be disabled.")

    def explain_detection(self, label: str, retries=3):
        if not self.client:
            return "Gemini API key is not configured."

        prompt = f"You are an astrophysicist. Briefly explain the astronomical object or concept '{label}' using a scientific and rational tone."

        for attempt in range(retries):
            try:
                response = self.client.models.generate_content(
                    model="gemini-2.5-flash", contents=prompt
                )
                return response.text
            except Exception as e:
                error_str = str(e)
                # 429 Rate Limit durumunda bekle ve tekrar dene
                if "429" in error_str or "resource_exhausted" in error_str.lower() or "limit" in error_str.lower():
                    if attempt < retries - 1:
                        print(f"DEBUG: Rate limit hit in explain_detection, sleeping 6s (Attempt {attempt+1}/{retries})...")
                        time.sleep(6)
                        continue
                # 503 veya geçici hata durumunda bekle ve tekrar dene
                if "503" in error_str or "unavailable" in error_str.lower():
                    if attempt < retries - 1:
                        time.sleep(2)
                        continue
                return f"Gemini Error: {str(e)}"
        
        return "Gemini service is currently unavailable. Please try again later."

    def analyze_coordinates(self, ra: float, dec: float, simbad_data=None, retries=4):
        if not self.client:
            return "Gemini API key is not configured."

        simbad_info = ""
        if simbad_data:
            simbad_info = f"""
SIMBAD query results for these coordinates:
- Target Name: {simbad_data.get('target_name', 'N/A')}
- Distance: {simbad_data.get('distance', 'N/A')}
- Magnitude: {simbad_data.get('magnitude', 'N/A')}
- Spectral Class: {simbad_data.get('spectral_class', 'N/A')}
"""

        prompt = f"""
You are an expert astronomer working for the ParsecVision project. 
Explain and comment on the celestial region at coordinates RA: {ra}, DEC: {dec}.
{simbad_info}
Provide a scientifically accurate commentary/storytelling text about this region. If SIMBAD data is provided above, please base your scientific commentary, target naming, and analysis on that catalogued object. If no catalogued object is provided or if fields are N/A, identify the constellation or deep space region located at these coordinates and explain its general characteristics.

Provide your response strictly in the following JSON format. Do not include any introductory or concluding text. The anomaly_scores should be an estimate of the celestial composition of the region (Star, Nebula, Galaxy, Artifact) and sum to 100:

{{
  "region_name": "Name of the target object or region (e.g. SIMBAD Target Name, or Constellation/Nebula name)",
  "key_features": "List three distinct physical or astronomical features of this object/region, separated by commas",
  "cosmic_note": "Provide a single, evocative, and scientifically accurate sentence describing this region",
  "detailed_analysis": "Provide a comprehensive, highly detailed 2-3 paragraph scientific commentary and description of this target. Discuss its composition, physical processes, distance, significance, and history. Format with paragraphs.",
  "anomaly_scores": {{
    "Star": 85,
    "Nebula": 10,
    "Galaxy": 2,
    "Artifact": 3
  }}
}}
"""

        for attempt in range(retries):
            try:
                response = self.client.models.generate_content(
                    model="gemini-2.5-flash", contents=prompt
                )
                return response.text
            except Exception as e:
                print(f"DEBUG: Gemini API Exception: {e}")
                import traceback; traceback.print_exc()
                error_str = str(e)
                # 429 Rate Limit durumunda bekle ve tekrar dene
                if "429" in error_str or "resource_exhausted" in error_str.lower() or "limit" in error_str.lower():
                    if attempt < retries - 1:
                        print(f"DEBUG: Rate limit hit in analyze_coordinates, sleeping 6s (Attempt {attempt+1}/{retries})...")
                        time.sleep(6)
                        continue
                # 503 veya geçici hata durumunda bekle ve tekrar dene
                if "503" in error_str or "unavailable" in error_str.lower():
                    if attempt < retries - 1:
                        time.sleep(2)
                        continue
                
                # Ağ hatası, kota sınırı (429) veya diğer hatalar için kullanıcıya bir hata JSON'ı döndür
                return '```json\n{"region_name": "Analysis Unavailable", "key_features": "Please try again later", "cosmic_note": "The AI service is currently overloaded or unavailable.", "detailed_analysis": "The ParsecVision AI core is currently processing an exceptionally high volume of requests, or the secure uplink to the neural network has temporarily reached its capacity.\\n\\nPlease wait a few seconds and initiate the \'ANALYZE REGION\' command again to retry the connection.", "anomaly_scores": {"Star": 0, "Nebula": 0, "Galaxy": 0, "Artifact": 100}}\n```'
        
        return "Gemini service is currently unavailable. Please try again later."