# Summora

**Your notes, simplified.**

Summora is a multi-agent learning module and quiz generator available as a web app and notebook. Independent Reader, Summary, Quiz, Reviewer, and Essay Grading agents turn PDF, TXT, or Markdown material into structured lessons, adaptive assessments, source-grounded feedback, and exportable study sessions. An optional Web Research Agent can search from a user prompt, preserve source URLs, and feed cited context into the same workflow.

## Web app

The web app supports multiple-choice, short-answer, matching, essay, math, language, image-prompt, and mixed quizzes. It includes:

- topic- and level-adaptive content style, tone, and difficulty
- detailed learning materials and source citations before the quiz
- server-held answer keys that are released only after final scoring
- objective scoring plus AI-assisted essay feedback
- quiz shuffling and source-grounded new variations
- LaTeX mappings, visual-question generation prompts, and text-to-speech controls
- JSON download, print/PDF-ready output, accuracy diagnostics, and local performance history

Start the API and frontend in separate terminals:

```bash
uvicorn backend.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). Set `GEMINI_API_KEY` or `DEEPSEEK_API_KEY` in `.env`; `MOCK_MODE=true` runs the complete pipeline without external model calls. Optional web research uses `TAVILY_API_KEY`.

Quiz answer keys are kept in API memory for four hours in this MVP. Production deployments should replace this with an encrypted shared session store so scoring works safely across multiple server instances.

## Notebook quick start

1. Use Python 3.10 or newer and install dependencies:

   ```bash
   python -m pip install -r requirements.txt
   ```

2. Open `summora_multi_agent.ipynb` in VS Code/Jupyter or upload it to Google Colab.
3. In the configuration cell, select `gemini` or `deepseek`. An empty model name uses the documented default shown in the notebook.
4. Set `GEMINI_API_KEY` or `DEEPSEEK_API_KEY` in the environment, use a Colab secret with that name, or enter it through the notebook's hidden `getpass` prompt.
5. Run the notebook from top to bottom, choose a supported file, and run the Summora cell.

## Optional web research

Web research uses the Tavily Search API and is disabled by default. Set `TAVILY_API_KEY` securely, change `CONFIG["web_research_enabled"]` to `True`, and recreate the orchestrator from Section 15.

```python
research = summora.research_prompt("What recent context would help explain this topic?")
result = summora.process_prompt_with_web_context("Explain the latest context around this topic")
result = summora.process_document_with_web_context(
    "sample_educational_text.md",
    "Find trustworthy supplemental context for this lesson",
)
```

Search results retain titles, URLs, source IDs, and cleaned excerpts. Retrieved text is treated as untrusted evidence, and the research agent is instructed to ignore instructions embedded in web pages. Tavily requests may consume API credits.

To try the entire workflow without an API call, set `MOCK_MODE = True`. The included `sample_educational_text.md` and `sample_evaluation.csv` are ready to use.

## Files

- `backend/` — FastAPI agents, schemas, scoring endpoints, and automated pipeline tests
- `frontend/` — React learning and quiz interface
- `summora_multi_agent.ipynb` — notebook workflow, tests, quiz, exports, and optional evaluation
- `sample_educational_text.md` — sample lesson
- `sample_evaluation.csv` — optional evaluation dataset
- `example_summora_result.json` — example mock-mode export
- `requirements.txt` — minimal runtime dependencies

No API key is stored or printed by the project.
