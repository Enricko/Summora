import re

with open('backend/core.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace system_instruction for FlashcardAgent
old_sys = """    system_instruction = \"\"\"AGENT_ID: FLASHCARD
You are Summora's independent Flashcard Agent. Use only the supplied grounded summary, key concepts,
and source headings. Never fabricate information or silently repair unclear source material.
Create clear, direct, non-duplicate questions with concise student-friendly answers. Include definitions,
concepts, comparisons, formulas, and examples only when supported. Follow the exact requested count and
difficulty distribution. Use an exact supplied heading for every source_section. Follow the requested
student education level and output language. Return valid JSON only matching the schema exactly, with no
Markdown fences or commentary.\"\"\""""

new_sys = """    system_instruction = \"\"\"AGENT_ID: FLASHCARD
You are Summora's independent Quiz Agent. Generate quiz questions using the specified quiz_type (e.g. image, essay, math, language, standard, or mixed).
When generating image questions, provide an image_search_query.
When generating essay questions, provide a grading rubric.
When generating math questions, provide a latex_formula.
When generating language questions, provide audio_text for TTS.
Follow the exact requested count and difficulty distribution. Use an exact supplied heading for every source_section. Return valid JSON exactly matching the requested schema.\"\"\""""

code = code.replace(old_sys, new_sys)

old_prompt_def = """    def _prompt(self, agent_input: FlashcardInput, prior: Optional[FlashcardResult] = None) -> str:
        targets = difficulty_targets(agent_input.requested_count)
        revision = "\\n".join(f"- {item}" for item in agent_input.revision_instructions) or "None"
        prior_text = prior.model_dump_json(indent=2) if prior else "None"
        return f\"\"\"Output language: {agent_input.output_language}
Student education level: {agent_input.education_level}
Exact flashcard count: {agent_input.requested_count}
Exact difficulty counts: {json.dumps(targets)}
Allowed source_section values: {json.dumps(agent_input.source_sections, ensure_ascii=False)}
Revision instructions: {revision}
Output schema: {json.dumps(self.output_model.model_json_schema(), ensure_ascii=False)}
Prior attempt to replace if present: {prior_text}

Create the complete set. Answers should usually be one to three sentences. JSON only.

GROUNDED SUMMARY:
{agent_input.summary.model_dump_json(indent=2)}\"\"\""""

new_prompt_def = """    def _prompt(self, agent_input: FlashcardInput, prior: Optional[FlashcardResult] = None) -> str:
        targets = difficulty_targets(agent_input.requested_count)
        revision = "\\n".join(f"- {item}" for item in agent_input.revision_instructions) or "None"
        prior_text = prior.model_dump_json(indent=2) if prior else "None"
        
        # Guide the schema based on quiz_type
        type_instruction = f"Generate ONLY {agent_input.quiz_type} questions." if agent_input.quiz_type != "mixed" else "Generate a MIX of question types (image, essay, math, language, standard)."
        
        return f\"\"\"Output language: {agent_input.output_language}
Student education level: {agent_input.education_level}
Quiz Type Requested: {agent_input.quiz_type} ({type_instruction})
Exact flashcard count: {agent_input.requested_count}
Exact difficulty counts: {json.dumps(targets)}
Allowed source_section values: {json.dumps(agent_input.source_sections, ensure_ascii=False)}
Revision instructions: {revision}
Output schema: {json.dumps(self.output_model.model_json_schema(), ensure_ascii=False)}
Prior attempt to replace if present: {prior_text}

Create the complete set. Follow the schema closely. JSON only.

GROUNDED SUMMARY:
{agent_input.summary.model_dump_json(indent=2)}\"\"\""""

code = code.replace(old_prompt_def, new_prompt_def)

with open('backend/core.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated FlashcardAgent prompt")
