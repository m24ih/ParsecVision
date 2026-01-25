import google.generativeai as genai
import os
import json

class LLMService:
    def __init__(self):
        # We get the API key from the .env file
        api_key = os.getenv("GEMINI_API_KEY")
        
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found. AI features will not work.")
            self.model = None
        else:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-3-flash-preview')
            except Exception as e:
                print(f"Gemini Connection Error: {e}")
                self.model = None

    def analyze_celestial_object(self, obj_name: str, obj_type: str, distance: str):
        """
        Retrieves astronomical data about the celestial body and extracts a summary in English.
        """
        if not self.model:
            return "AI Service Disabled (API Key Missing or Invalid)"

        prompt = f"""
        You are an expert astrophysicist. Using the celestial body data below,
        write a scientific but understandable short summary (maximum 3 sentences) appealing to a curious user.
        
        Object Information:
        - Name: {obj_name}
        - Type: {obj_type}
        - Distance: {distance} parsec
        
        Your summary should be in the following format:
        1. What exactly is this object?
        2. Why is it scientifically important or what is an interesting feature of it?
        """

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"Error occurred during analysis: {str(e)}"
