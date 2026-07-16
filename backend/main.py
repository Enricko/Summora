from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uvicorn
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from .models import (
    ReaderInput,
    WebResearchInput,
    FlashcardInput,
    SummaryInput,
    QuizQuestion
)
from .core import (
    SummoraOrchestrator,
    GeminiProvider,
    DeepSeekProvider,
    MockProvider,
    TavilySearchProvider,
    MockWebSearchProvider,
    DEFAULT_MODELS,
    ReaderAgent,
    SummaryAgent,
    FlashcardAgent,
    WebResearchAgent,
)

app = FastAPI(title="Summora Quiz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_orchestrator():
    # Setup Provider
    gemini_key = os.environ.get("GEMINI_API_KEY")
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    
    if deepseek_key:
        provider = DeepSeekProvider(api_key=deepseek_key)
        provider_name = "deepseek"
        model_name = "deepseek-v4-flash"
    elif gemini_key:
        provider = GeminiProvider(api_key=gemini_key)
        provider_name = "gemini"
        model_name = "gemini-3.5-flash"
    else:
        provider = MockProvider()
        provider_name = "mock"
        model_name = "mock"
    
    config = {
        "provider": provider_name,
        "model_name": model_name,
        "summary_length": "medium",
        "flashcard_count": 5,
        "education_level": "university",
        "output_language": "English",
        "temperature": 0.2,
        "maximum_chunk_characters": 10000,
        "maximum_retries": 3,
        "review_threshold": 75,
        "web_research_enabled": True,
        "web_search_provider": "tavily",
        "web_max_sources": 3,
        "web_search_depth": "basic",
        "web_topic": "general"
    }
    
    tavily_api_key = os.environ.get("TAVILY_API_KEY")
    web_provider = TavilySearchProvider(api_key=tavily_api_key, config=config) if tavily_api_key else MockWebSearchProvider()
    
    return SummoraOrchestrator(provider=provider, config=config, web_search_provider=web_provider)

class QuizRequest(BaseModel):
    text: str
    quiz_type: str = "mixed"
    count: int = 5
    education_level: str = "university"

@app.post("/api/quiz")
async def generate_quiz(req: QuizRequest):
    orchestrator = get_orchestrator()
    
    # 1. Reader Agent
    reader_input = ReaderInput(text=req.text, title="Uploaded Text")
    reader_result = orchestrator.reader_agent.execute(reader_input)
    
    # 2. Summary Agent
    summary_input = SummaryInput(
        document=reader_result,
        summary_length="medium",
        education_level=req.education_level,
        output_language="English"
    )
    summary_result = orchestrator.summary_agent.execute(summary_input)
    
    # 3. Flashcard (Quiz) Agent
    flashcard_input = FlashcardInput(
        summary=summary_result,
        source_sections=[s.heading for s in reader_result.sections],
        requested_count=req.count,
        education_level=req.education_level,
        output_language="English",
        quiz_type=req.quiz_type
    )
    flashcard_result = orchestrator.flashcard_agent.execute(flashcard_input)
    
    return {
        "summary": summary_result.model_dump(),
        "quiz": flashcard_result.model_dump()
    }

class ResearchRequest(BaseModel):
    query: str
    topic: str = "general"

@app.post("/api/research")
async def do_research(req: ResearchRequest):
    orchestrator = get_orchestrator()
    if not orchestrator.web_research_agent:
        raise HTTPException(status_code=500, detail="Web research not enabled (missing TAVILY_API_KEY)")
    
    research = orchestrator.research_prompt(req.query)
    # Convert research into a document format for quiz generation
    doc_text = orchestrator._research_as_document(research)
    
    return {
        "research": research.model_dump(),
        "document_text": doc_text
    }

@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    # Save the file temporarily
    temp_path = f"/tmp/{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Import here to avoid circular imports if any, or just use core
        from .core import read_pdf_file
        text = read_pdf_file(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return {"text": text}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
