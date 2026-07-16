from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uvicorn
from typing import Optional, Dict, Any

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
    DEFAULT_MODELS,
    ReaderAgent,
    SummaryAgent,
    FlashcardAgent,
    WebResearchAgent,
    TavilySearchProvider
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
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")
    
    provider = GeminiProvider(api_key=api_key)
    config = {
        "provider": "gemini",
        "model_name": "gemini-3.5-flash",
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
    web_provider = TavilySearchProvider(api_key=tavily_api_key) if tavily_api_key else None
    
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

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
