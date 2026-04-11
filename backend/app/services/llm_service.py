import os
from google import genai


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            print("WARNING: GEMINI_API_KEY not found. AI analysis will be disabled.")

    def explain_detection(self, label: str):
        if not self.client:
            return "Gemini API key is not configured."

        prompt = f"You are an astrophysicist. Briefly explain the astronomical object or concept '{label}' using a scientific and rational tone."

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Gemini Error: {str(e)}"

    def analyze_coordinates(self, ra: float, dec: float):
        if not self.client:
            return "Gemini API key is not configured."

        prompt = (
            f"You are the AI astronomer for the ParsecVision platform. "
            f"A user uploaded a telescope image, and Astrometry.net solved the coordinates as "
            f"Right Ascension (RA): {ra}°, Declination (Dec): {dec}°. "
            f"Please explain where these coordinates point to in the universe, identify any famous celestial bodies "
            f"(galaxies, nebulae, star clusters, etc.) located in this region, and describe the astrophysical significance "
            f"of this area in a rational and direct tone."
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Gemini Error: {str(e)}"
