import re

with open('backend/summora_original.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the StrictModel and all Pydantic models up to FinalSummoraResult
start_marker = "class StrictModel(BaseModel):"
end_marker = "class FinalSummoraResult(StrictModel):"

start_idx = code.find(start_marker)
end_idx = code.find("class LLMProvider(ABC):", start_idx)

if start_idx != -1 and end_idx != -1:
    new_code = code[:start_idx] + "from .models import *\n" + code[end_idx:]
    with open('backend/core.py', 'w', encoding='utf-8') as f:
        f.write(new_code)
    print("Patched core.py successfully")
else:
    print("Could not find markers")
