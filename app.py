from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import PyPDF2
import io
from google import genai
from google.api_core import exceptions
from google.genai import types
import json


# Çevresel değişkenleri yüklüyoruz
load_dotenv()

# Google Gen AI Client yapılandırması
api_key = os.getenv("GOOGLE_AI_API_KEY")
client = genai.Client(api_key=api_key)

app = FastAPI()

# CORS Yapılandırması: Frontend'in backend'e erişmesine izin verir
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Job Platform Backend is running successfully on port 8002!"}

@app.get("/get-firebase-configuration")
async def get_firebase_configuration():
    """Frontend'in Firebase'e bağlanması için gerekli ayarları döner."""
    try:
        return {
            "apiKey": os.getenv("FIREBASE_API_KEY"),
            "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
            "projectId": os.getenv("FIREBASE_PROJECT_ID"),
            "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
            "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
            "appId": os.getenv("FIREBASE_APP_ID"),
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.post("/analyze-cv")
async def analyze_cv(file: UploadFile = File(...)):
    """PDF dosyasını okur ve Gemini ile analiz eder."""
    try:
        # PDF dosyasını okuma işlemi
        pdf_content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        resume_text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                resume_text += page_text + "\n"

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="PDF metni boş veya okunamadı.")

        # 1) JSON şema tanımı
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "full_name": types.Schema(type=types.Type.STRING),
                "headline": types.Schema(type=types.Type.STRING),
                "location": types.Schema(type=types.Type.STRING),
                "skills": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(type=types.Type.STRING),
                ),
                "experience_years": types.Schema(type=types.Type.NUMBER),
                "seniority": types.Schema(type=types.Type.STRING),
                "summary": types.Schema(type=types.Type.STRING),
            },
            required=["full_name", "headline", "skills", "summary"],
        )

       # 2) Prompt – modelden sadece bu şemaya uygun JSON isteme
        prompt = f"""
        You are an expert technical recruiter.

        Extract a structured candidate profile from the CV below.

        Return ONLY a JSON object matching this schema, without any extra text:
        {{
          "full_name": string,
          "headline": string,
          "location": string,
          "skills": string[],
          "experience_years": number,
          "seniority": string,
          "summary": string
        }}

        CV:
        {resume_text}
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.4,
        )

        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
            config=config,
        )
        raw_text = response.text  # senin örneğinde JSON burada geliyor
        profile_data = json.loads(raw_text)
        
        return {
            "status": "success",
            "profile": profile_data,      # ← dashboard buradan okuyacak
            "raw_analysis": raw_text, # istersen tam JSON'u da gösteriyoruz
            }

    except Exception as error:
        # Kota aşımı (Rate Limit) hatasını kontrol ediyoruz
        error_message = str(error)
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message:
            raise HTTPException(
                status_code=429, 
                detail="Gemini AI limits are exhausted for now. Please wait a minute and try again."
            )
        
        raise HTTPException(status_code=500, detail=f"AI Analysis failed: {error_message}")

if __name__ == "__main__":
    import uvicorn
    # Uygulama 8002 portunda çalışmaya devam ediyor
    uvicorn.run(app, host="0.0.0.0", port=8002)