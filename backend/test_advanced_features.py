import unittest

from fastapi.testclient import TestClient

from backend import main
from backend.core import CONFIG, MockProvider, MockWebSearchProvider, SummoraOrchestrator
from backend.models import EssayQuestion, MatchingQuestion, MultipleChoiceQuestion


def mock_orchestrator() -> SummoraOrchestrator:
    config = {
        **CONFIG,
        "provider": "mock",
        "model_name": "mock",
        "flashcard_count": 7,
        "web_research_enabled": True,
        "web_max_sources": 2,
    }
    return SummoraOrchestrator(MockProvider(), config, MockWebSearchProvider())


class AdvancedQuizApiTests(unittest.TestCase):
    def setUp(self) -> None:
        main.QUIZ_SESSIONS.clear()
        self.original_factory = main.get_orchestrator
        main.get_orchestrator = mock_orchestrator
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.get_orchestrator = self.original_factory
        main.QUIZ_SESSIONS.clear()

    def test_answer_keys_stay_server_side_until_grading(self) -> None:
        response = self.client.post("/api/quiz", json={
            "text": (
                "# Cells\nCells contain membranes and DNA.\n\n"
                "# Energy\nCells use energy for biological processes."
            ),
            "quiz_type": "mixed",
            "count": 7,
            "education_level": "university",
            "summary_length": "medium",
        })
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        questions = payload["quiz"]["flashcards"]
        self.assertEqual(len(questions), 7)
        self.assertTrue(payload["summary"]["learning_materials"])
        self.assertEqual({item["type"] for item in questions}, {
            "multiple_choice", "standard", "matching", "essay", "math", "language", "image",
        })
        for question in questions:
            self.assertNotIn("answer", question)
            self.assertNotIn("explanation", question)
            self.assertTrue(question["citations"])
            if question["type"] == "multiple_choice":
                self.assertNotIn("correct_option_index", question)
            if question["type"] == "matching":
                self.assertNotIn("pairs", question)
                self.assertNotIn("mapping_latex", question)

        stored = main.QUIZ_SESSIONS[payload["quiz_id"]]
        answers = {}
        for record in stored["questions"]:
            card = record["card"]
            if isinstance(card, MultipleChoiceQuestion):
                answers[record["question_id"]] = card.correct_option_index
            elif isinstance(card, MatchingQuestion):
                answers[record["question_id"]] = {pair.left: pair.right for pair in card.pairs}
            elif isinstance(card, EssayQuestion):
                answers[record["question_id"]] = card.answer
            else:
                answers[record["question_id"]] = card.answer

        grade = self.client.post("/api/grade_quiz", json={
            "quiz_id": payload["quiz_id"],
            "answers": answers,
        })
        self.assertEqual(grade.status_code, 200, grade.text)
        graded = grade.json()
        self.assertTrue(graded["answer_key_released"])
        self.assertGreaterEqual(graded["final_score"], 70)
        self.assertTrue(all(item.get("expected_answer") for item in graded["results"]))
        self.assertEqual(graded["session_log"]["event"], "quiz_completed")


if __name__ == "__main__":
    unittest.main()
