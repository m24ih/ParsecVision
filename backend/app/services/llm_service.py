import google.generativeai as genai
import os
import json

class LLMService:
    def __init__(self):
        # .env dosyasından API anahtarını alıyoruz
        api_key = os.getenv("GEMINI_API_KEY")
        
        if not api_key:
            print("UYARI: GEMINI_API_KEY bulunamadı. AI özellikleri çalışmayacak.")
            self.model = None
        else:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-3-flash-preview')
            except Exception as e:
                print(f"Gemini Bağlantı Hatası: {e}")
                self.model = None

    def analyze_celestial_object(self, obj_name: str, obj_type: str, distance: str):
        """
        Gök cismi hakkında astronomik verileri alıp Türkçe özet çıkarır.
        """
        if not self.model:
            return "AI Servisi Devre Dışı (API Key Eksik veya Hatalı)"

        prompt = f"""
        Sen uzman bir astrofizikçisin. Aşağıdaki gök cismi verilerini kullanarak,
        meraklı bir kullanıcıya hitap eden, bilimsel ama anlaşılır kısa bir özet (maksimum 3 cümle) yaz.
        
        Cisim Bilgileri:
        - İsim: {obj_name}
        - Tür: {obj_type}
        - Uzaklık: {distance} parsec
        
        Özetin şu formatta olsun:
        1. Bu cisim tam olarak nedir?
        2. Bilimsel olarak neden önemlidir veya ilginç bir özelliği nedir?
        """

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"Analiz sırasında hata oluştu: {str(e)}"
