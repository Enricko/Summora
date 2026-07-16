from typing import Any, Literal, Optional, Union, List
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class DocumentSection(StrictModel):
    heading: str = Field(min_length=1)
    content: str = Field(min_length=1)

class ReaderInput(StrictModel):
    file_path: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None

    @model_validator(mode="after")
    def require_one_source(self) -> "ReaderInput":
        if bool(self.file_path) == bool(self.text):
            raise ValueError("Provide exactly one of file_path or text.")
        return self

class ReaderResult(StrictModel):
    document_title: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    language: str = Field(min_length=1)
    sections: list[DocumentSection] = Field(min_length=1)
    total_characters: int = Field(ge=1)

class KeyPoint(StrictModel):
    point: str = Field(min_length=1)
    source_section: str = Field(min_length=1)

class ImportantTerm(StrictModel):
    term: str = Field(min_length=1)
    definition: str = Field(min_length=1)
    category: Literal["definition", "formula", "date", "name", "example", "concept"] = "concept"
    source_section: str = Field(min_length=1)

class PracticeQuestion(StrictModel):
    question: str = Field(min_length=1)
    answer_guide: str = Field(min_length=1)
    source_section: str = Field(min_length=1)

class SummaryInput(StrictModel):
    document: ReaderResult
    summary_length: Literal["short", "medium", "detailed"] = "medium"
    education_level: str = "university"
    output_language: str = "English"
    revision_instructions: list[str] = Field(default_factory=list)

class SummaryResult(StrictModel):
    short_summary: str = Field(min_length=1)
    detailed_summary: str = Field(min_length=1)
    key_points: list[KeyPoint] = Field(min_length=1)
    important_terms: list[ImportantTerm] = Field(default_factory=list)
    practice_questions: list[PracticeQuestion] = Field(default_factory=list)
    learning_recommendations: list[str] = Field(default_factory=list)

# --- New Quiz Types ---

class QuizQuestionBase(StrictModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    difficulty: Literal["easy", "medium", "hard"]
    topic: str = Field(min_length=1)
    source_section: str = Field(min_length=1)
    type: str

class ImageQuestion(QuizQuestionBase):
    type: Literal["image"] = "image"
    image_search_query: str = Field(min_length=1, description="A search query to find an image related to this question.")

class EssayQuestion(QuizQuestionBase):
    type: Literal["essay"] = "essay"
    rubric: str = Field(min_length=1, description="Grading rubric for the essay.")

class MathQuestion(QuizQuestionBase):
    type: Literal["math"] = "math"
    latex_formula: str = Field(min_length=1, description="LaTeX representation of the math formulation.")

class LanguageQuestion(QuizQuestionBase):
    type: Literal["language"] = "language"
    pronunciation_guide: Optional[str] = Field(default=None)
    audio_text: str = Field(min_length=1, description="Text to be spoken by TTS.")

class StandardFlashcard(QuizQuestionBase):
    type: Literal["standard"] = "standard"

QuizQuestion = Union[ImageQuestion, EssayQuestion, MathQuestion, LanguageQuestion, StandardFlashcard]

class FlashcardInput(StrictModel):
    summary: SummaryResult
    source_sections: list[str] = Field(min_length=1)
    requested_count: int = Field(ge=1, le=100)
    education_level: str = "university"
    output_language: str = "English"
    revision_instructions: list[str] = Field(default_factory=list)
    quiz_type: Literal["mixed", "image", "essay", "math", "language", "standard"] = "mixed"

class FlashcardResult(StrictModel):
    flashcards: list[QuizQuestion] = Field(min_length=1)

# ---

class ReviewerInput(StrictModel):
    document: ReaderResult
    summary: SummaryResult
    flashcards: FlashcardResult
    education_level: str = "university"
    output_language: str = "English"

class ReviewResult(StrictModel):
    quality_score: int = Field(ge=0, le=100)
    approved: bool
    issues: list[str] = Field(default_factory=list)
    revision_instructions: list[str] = Field(default_factory=list)

class WebResearchInput(StrictModel):
    query: str = Field(min_length=3, max_length=2_000)
    context_goal: str = Field(default="", max_length=2_000)
    max_sources: int = Field(default=5, ge=1, le=10)
    search_depth: Literal["basic", "advanced"] = "basic"
    topic: Literal["general", "news", "finance"] = "general"
    include_domains: list[str] = Field(default_factory=list, max_length=20)
    exclude_domains: list[str] = Field(default_factory=list, max_length=20)
    education_level: str = "university"
    output_language: str = "English"

class WebSource(StrictModel):
    source_id: str = Field(pattern=r"^S\d+$")
    title: str = Field(min_length=1)
    url: str = Field(pattern=r"^https?://")
    content: str = Field(min_length=1)
    score: Optional[float] = Field(default=None, ge=0)

class WebFinding(StrictModel):
    finding: str = Field(min_length=1)
    source_ids: list[str] = Field(min_length=1)

class WebResearchSynthesis(StrictModel):
    answer: str = Field(min_length=1)
    key_findings: list[WebFinding] = Field(min_length=1)
    limitations: list[str] = Field(default_factory=list)

class WebResearchResult(StrictModel):
    query: str = Field(min_length=3)
    answer: str = Field(min_length=1)
    key_findings: list[WebFinding] = Field(min_length=1)
    sources: list[WebSource] = Field(min_length=1)
    limitations: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    searched_at: str = Field(min_length=1)

class FinalSummoraResult(StrictModel):
    success: bool
    reader_result: Optional[ReaderResult] = None
    summary_result: Optional[SummaryResult] = None
    flashcard_result: Optional[FlashcardResult] = None
    review_result: Optional[ReviewResult] = None
    agent_status: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
