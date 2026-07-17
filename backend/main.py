from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import os
import random
import re
import uuid
import uvicorn
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any, Literal
from dotenv import load_dotenv

load_dotenv()

from .models import (
    ReaderInput,
    WebResearchInput,
    FlashcardInput,
    SummaryInput,
    ReviewerInput,
    QuizQuestion,
    EssayQuestion,
    EssayGradingInput,
    MatchingQuestion,
    MultipleChoiceQuestion,
)
from .core import (
    SummoraOrchestrator,
    SummoraError,
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
    EssayGradingAgent,
    LOGGER,
    sanitize_error,
)

app = FastAPI(title="Summora Quiz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SummoraError)
async def handle_summora_error(_request: Request, exc: SummoraError) -> JSONResponse:
    """Turn model/provider failures into a safe, actionable API response."""
    detail = sanitize_error(exc)
    LOGGER.error("Summora pipeline error: %s", detail)
    return JSONResponse(
        status_code=502,
        content={
            "detail": (
                f"AI generation failed: {detail}. "
                "Try again, generate a new variation, or verify the configured model provider."
            )
        },
    )

QUIZ_SESSION_TTL = timedelta(hours=4)
QUIZ_SESSIONS: dict[str, dict[str, Any]] = {}


def build_adaptive_profile(subject: str, education_level: str, quiz_type: str) -> dict[str, str]:
    """Choose a stable visual/content profile without adding another model call."""
    normalized = subject.casefold()
    if any(term in normalized for term in ("math", "physics", "engineering", "computer")):
        theme, style = "analytical", "structured, formula-forward, and problem-solving focused"
    elif any(term in normalized for term in ("biology", "chemistry", "science", "medicine")):
        theme, style = "scientific", "visual, evidence-led, and concept-to-process focused"
    elif any(term in normalized for term in ("history", "language", "literature", "social")):
        theme, style = "narrative", "contextual, chronological, and example-rich"
    else:
        theme, style = "balanced", "clear, structured, and concept-first"

    young_levels = {"preschool", "elementary", "middle_school"}
    tone = (
        "encouraging, concrete, and low-jargon"
        if education_level in young_levels else
        "supportive, academically precise, and concise"
    )
    return {
        "theme": theme,
        "content_style": style,
        "tone": tone,
        "difficulty_strategy": f"Adaptive {education_level} progression for {quiz_type} questions",
    }


def _cleanup_quiz_sessions() -> None:
    cutoff = datetime.now(timezone.utc) - QUIZ_SESSION_TTL
    expired = [quiz_id for quiz_id, value in QUIZ_SESSIONS.items() if value["created_at"] < cutoff]
    for quiz_id in expired:
        QUIZ_SESSIONS.pop(quiz_id, None)


def _public_question(card: QuizQuestion, question_id: str, rng: random.Random) -> dict[str, Any]:
    """Return only information that may be revealed before final scoring."""
    public = card.model_dump()
    public["question_id"] = question_id
    public.pop("answer", None)
    public.pop("explanation", None)
    if isinstance(card, MultipleChoiceQuestion):
        public.pop("correct_option_index", None)
    if isinstance(card, MatchingQuestion):
        pairs = public.pop("pairs")
        public.pop("mapping_latex", None)
        public["left_items"] = [pair["left"] for pair in pairs]
        right_options = [pair["right"] for pair in pairs]
        rng.shuffle(right_options)
        public["right_options"] = right_options
    return public


def _normalized_similarity(response: str, expected: str) -> int:
    response_text = " ".join(re.findall(r"\w+", response.casefold(), flags=re.UNICODE))
    expected_text = " ".join(re.findall(r"\w+", expected.casefold(), flags=re.UNICODE))
    if not response_text:
        return 0
    if response_text == expected_text:
        return 100
    sequence = SequenceMatcher(None, response_text, expected_text).ratio()
    response_terms, expected_terms = set(response_text.split()), set(expected_text.split())
    overlap = len(response_terms & expected_terms)
    precision = overlap / max(1, len(response_terms))
    recall = overlap / max(1, len(expected_terms))
    token_f1 = 2 * precision * recall / max(0.0001, precision + recall)
    return round(max(sequence, token_f1) * 100)

def get_orchestrator():
    # Setup Provider
    mock_mode = os.environ.get("MOCK_MODE", "").strip().casefold() in {"1", "true", "yes", "on"}
    gemini_key = os.environ.get("GEMINI_API_KEY")
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")

    if mock_mode:
        provider = MockProvider()
        provider_name = "mock"
        model_name = "mock"
    elif deepseek_key:
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
    text: str = Field(min_length=1, max_length=200_000)
    quiz_type: Literal[
        "mixed", "image", "essay", "math", "language", "standard", "multiple_choice", "matching"
    ] = "mixed"
    count: int = Field(default=5, ge=1, le=20)
    education_level: str = "university"
    summary_length: Literal["short", "medium", "detailed"] = "medium"
    variation_seed: str | None = None
    excluded_questions: list[str] = Field(default_factory=list, max_length=30)
    source_references: list[dict[str, str]] = Field(default_factory=list, max_length=10)

@app.post("/api/quiz")
async def generate_quiz(req: QuizRequest):
    orchestrator = get_orchestrator()

    # 1. Reader Agent
    reader_input = ReaderInput(text=req.text, title="Uploaded Text")
    reader_result = orchestrator.reader_agent.execute(reader_input)
    output_language = reader_result.language
    adaptive_profile = build_adaptive_profile(reader_result.subject, req.education_level, req.quiz_type)

    # 2. Summary Agent
    summary_input = SummaryInput(
        document=reader_result,
        summary_length=req.summary_length,
        education_level=req.education_level,
        output_language=output_language,
        content_style=adaptive_profile["content_style"],
        tone=adaptive_profile["tone"],
    )
    summary_result = orchestrator.summary_agent.execute(summary_input)

    # 3. Flashcard (Quiz) Agent
    flashcard_input = FlashcardInput(
        summary=summary_result,
        source_sections=[s.heading for s in reader_result.sections],
        requested_count=req.count,
        education_level=req.education_level,
        output_language=output_language,
        content_style=adaptive_profile["content_style"],
        tone=adaptive_profile["tone"],
        quiz_type=req.quiz_type,
        variation_seed=req.variation_seed,
        excluded_questions=req.excluded_questions,
    )
    flashcard_result = orchestrator.flashcard_agent.execute(flashcard_input)

    # 4. Reviewer Agent: audit the generated learning material before returning it.
    review_input = ReviewerInput(
        document=reader_result,
        summary=summary_result,
        flashcards=flashcard_result,
        education_level=req.education_level,
        output_language=output_language,
    )
    review_result = orchestrator.reviewer_agent.execute(review_input)

    # Apply one focused revision when the reviewer detects grounding or clarity issues.
    if not review_result.approved:
        instructions = review_result.revision_instructions or review_result.issues
        summary_result = orchestrator.summary_agent.execute(
            summary_input.model_copy(update={"revision_instructions": instructions})
        )
        flashcard_result = orchestrator.flashcard_agent.execute(
            flashcard_input.model_copy(update={
                "summary": summary_result,
                "revision_instructions": instructions,
            })
        )
        review_result = orchestrator.reviewer_agent.execute(
            review_input.model_copy(update={
                "summary": summary_result,
                "flashcards": flashcard_result,
            })
        )
    _cleanup_quiz_sessions()
    quiz_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    generated_at = datetime.now(timezone.utc)
    rng = random.Random(req.variation_seed or quiz_id)
    question_records: list[dict[str, Any]] = []
    public_questions: list[dict[str, Any]] = []
    for card in flashcard_result.flashcards:
        question_id = str(uuid.uuid4())
        question_records.append({"question_id": question_id, "card": card})
        public_questions.append(_public_question(card, question_id, rng))

    QUIZ_SESSIONS[quiz_id] = {
        "created_at": generated_at,
        "session_id": session_id,
        "questions": question_records,
        "education_level": req.education_level,
        "review": review_result,
        "subject": reader_result.subject,
        "provider": orchestrator.config.get("provider", "unknown"),
        "model": orchestrator.config.get("model_name", "unknown"),
    }

    source_references = req.source_references or [
        {"label": section.heading, "source_section": section.heading}
        for section in reader_result.sections
    ]
    return {
        "session_id": session_id,
        "quiz_id": quiz_id,
        "generated_at": generated_at.isoformat(),
        "summary": summary_result.model_dump(),
        "quiz": {"flashcards": public_questions},
        "review": review_result.model_dump(),
        "adaptive_style": adaptive_profile,
        "references": source_references,
        "accuracy_diagnostic": {
            "score": review_result.quality_score,
            "confidence": "high" if review_result.quality_score >= 90 else (
                "medium" if review_result.quality_score >= 75 else "low"
            ),
            "approved": review_result.approved,
            "checks": [
                "Source grounding", "Question citations", "Duplicate detection",
                "Difficulty balance", "Answer-leak prevention", "Format validation",
            ],
            "issues": review_result.issues,
        },
        "document": {
            "title": reader_result.document_title,
            "subject": reader_result.subject,
            "language": reader_result.language,
            "sections": [section.heading for section in reader_result.sections],
        },
        "metadata": {
            "provider": orchestrator.config.get("provider", "unknown"),
            "model": orchestrator.config.get("model_name", "unknown"),
            "answer_key_released": False,
        },
    }


class QuizSubmissionRequest(BaseModel):
    quiz_id: str = Field(min_length=1)
    answers: dict[str, Any]


@app.post("/api/grade_quiz")
async def grade_quiz(req: QuizSubmissionRequest):
    _cleanup_quiz_sessions()
    stored = QUIZ_SESSIONS.get(req.quiz_id)
    if not stored:
        raise HTTPException(
            status_code=404,
            detail="This quiz session expired or does not exist. Generate a new variation and try again.",
        )

    orchestrator = get_orchestrator()
    essay_grader = EssayGradingAgent(orchestrator.provider, orchestrator.config)
    results: list[dict[str, Any]] = []
    grading_confidences: list[int] = []

    for record in stored["questions"]:
        question_id = record["question_id"]
        card: QuizQuestion = record["card"]
        response = req.answers.get(question_id)
        score = 0
        feedback = "No answer was submitted."
        strengths: list[str] = []
        improvements: list[str] = []
        extra: dict[str, Any] = {}
        grading_confidence = 95

        if isinstance(card, MultipleChoiceQuestion):
            try:
                selected_index = int(response)
            except (TypeError, ValueError):
                selected_index = -1
            score = 100 if selected_index == card.correct_option_index else 0
            feedback = "Correct selection." if score == 100 else "Review why the keyed option best matches the source."
            extra["correct_option_index"] = card.correct_option_index
            extra["expected_answer"] = card.options[card.correct_option_index]
        elif isinstance(card, MatchingQuestion):
            submitted_mapping = response if isinstance(response, dict) else {}
            correct_mapping = {pair.left: pair.right for pair in card.pairs}
            correct_pairs = sum(
                1 for left, right in correct_mapping.items() if submitted_mapping.get(left) == right
            )
            score = round((correct_pairs / len(correct_mapping)) * 100)
            feedback = f"{correct_pairs} of {len(correct_mapping)} mappings are correct."
            extra.update({
                "correct_mapping": correct_mapping,
                "mapping_latex": card.mapping_latex,
                "expected_answer": card.answer,
            })
        elif isinstance(card, EssayQuestion):
            student_response = str(response or "").strip()
            if student_response:
                try:
                    grade = essay_grader.execute(EssayGradingInput(
                        question=card.question,
                        reference_answer=card.answer,
                        rubric=card.rubric,
                        student_response=student_response,
                        education_level=stored["education_level"],
                        source_section=card.source_section,
                    ))
                    score = grade.score
                    feedback = grade.feedback
                    strengths = grade.strengths
                    improvements = grade.improvements
                    grading_confidence = grade.confidence
                except SummoraError as exc:
                    score = _normalized_similarity(student_response, card.answer)
                    feedback = (
                        "Automated essay feedback was unavailable; a conservative reference-answer "
                        f"comparison was used. {sanitize_error(exc)}"
                    )
                    grading_confidence = 55
            extra["expected_answer"] = card.answer
            extra["rubric"] = card.rubric
        else:
            student_response = str(response or "").strip()
            score = _normalized_similarity(student_response, card.answer)
            feedback = (
                "The response closely matches the source-grounded answer."
                if score >= 70 else
                "Compare your response with the source-grounded answer and add the missing key ideas."
            )
            grading_confidence = 85
            extra["expected_answer"] = card.answer

        grading_confidences.append(grading_confidence)
        results.append({
            "question_id": question_id,
            "type": card.type,
            "score": score,
            "correct": score >= 70,
            "feedback": feedback,
            "strengths": strengths,
            "improvements": improvements,
            "explanation": card.explanation or card.answer,
            "citations": card.citations or [card.source_section],
            "source_section": card.source_section,
            "grading_confidence": grading_confidence,
            **extra,
        })

    final_score = round(sum(item["score"] for item in results) / max(1, len(results)))
    content_accuracy = stored["review"].quality_score
    completed_at = datetime.now(timezone.utc).isoformat()
    response = {
        "session_id": stored["session_id"],
        "quiz_id": req.quiz_id,
        "final_score": final_score,
        "correct_count": sum(item["correct"] for item in results),
        "question_count": len(results),
        "results": results,
        "completed_at": completed_at,
        "diagnostic": {
            "content_accuracy": content_accuracy,
            "grading_confidence": round(sum(grading_confidences) / max(1, len(grading_confidences))),
            "provider": stored["provider"],
            "model": stored["model"],
            "note": "AI grading is advisory; instructors should review high-stakes essay decisions.",
        },
        "session_log": {
            "event": "quiz_completed",
            "session_id": stored["session_id"],
            "quiz_id": req.quiz_id,
            "subject": stored["subject"],
            "score": final_score,
            "completed_at": completed_at,
        },
        "answer_key_released": True,
    }
    stored["last_submission"] = response
    LOGGER.info(
        "Quiz completed: session=%s score=%s questions=%s",
        stored["session_id"], final_score, len(results),
    )
    return response

class ResearchRequest(BaseModel):
    query: str
    topic: str = "general"

@app.post("/api/research")
async def do_research(req: ResearchRequest):
    orchestrator = get_orchestrator()
    if not orchestrator.web_research_agent:
        raise HTTPException(status_code=500, detail="Web research not enabled (missing TAVILY_API_KEY)")

    try:
        research = orchestrator.research_prompt(req.query)
    except SummoraError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Web research provider failed: {sanitize_error(exc)} Try again or turn off web research.",
        ) from exc
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
