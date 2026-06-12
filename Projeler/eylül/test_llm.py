import sys
import os
import json
from dotenv import load_dotenv

sys.path.append("/Users/eylul./Desktop/Projeler/ParsecVision-main/backend")
load_dotenv("/Users/eylul./Desktop/Projeler/ParsecVision-main/.env")

from app.services.llm_service import LLMService

llm = LLMService()
res = llm.analyze_coordinates(156.0, -57.7)
print("RAW:")
print(res)
try:
    clean = res.replace("```json", "").replace("```", "").strip()
    json.loads(clean)
    print("Valid JSON")
except Exception as e:
    print("Invalid JSON:", e)
