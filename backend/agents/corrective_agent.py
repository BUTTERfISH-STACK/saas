from backend.ollama_client import OllamaClient
from backend.schemas import CritiqueRequest
from typing import Dict, Any
import os

class CorrectiveAgent:
    """Redo / Corrective Agent for iterative task refinement and self-critique"""
    
    def __init__(self, ollama_client: OllamaClient):
        self.ollama = ollama_client
        # Fast model for critique (low latency) - default to lightweight llama3.2:3b so it works with minimal models
        self.critique_model = os.getenv("CRITIQUE_MODEL", "llama3.2:3b")
    
    def critique_output(self, request: CritiqueRequest) -> Dict[str, Any]:
        """Evaluate a draft and decide if redo is needed"""
        
        critique_prompt = f"""You are a strict, expert career document reviewer and ATS specialist.

**Task:** Critically review the following draft against the rules and original context.

**Rules (must follow all):**
{chr(10).join(f"- {rule}" for rule in request.rules)}

**Original Context / Source Material:**
{request.original_context}

**Draft to Review:**
{request.draft}

**Output Format (strict JSON):**
{{
  "needs_redo": true/false,
  "score": 0-100,
  "issues": ["list of specific problems"],
  "suggestions": ["actionable improvements"],
  "feedback_for_redo": "Clear instructions for the next iteration"
}}

Only return valid JSON. Be ruthless but fair. Prioritize truthfulness above all."""

        try:
            response = self.ollama.chat(
                model=self.critique_model,
                messages=[{"role": "user", "content": critique_prompt}],
                format="json"  # Ollama JSON mode if supported
            )
            
            import json
            critique = json.loads(response["message"]["content"])
            
            return {
                "needs_redo": critique.get("needs_redo", False),
                "score": critique.get("score", 70),
                "issues": critique.get("issues", []),
                "suggestions": critique.get("suggestions", []),
                "feedback": critique.get("feedback_for_redo", ""),
                "model_used": self.critique_model,
                "success": True
            }
        except Exception as e:
            # Fallback simple critique
            return {
                "needs_redo": False,
                "score": 75,
                "issues": ["Critique model failed - manual review recommended"],
                "suggestions": [],
                "feedback": "Unable to perform automated critique due to technical error.",
                "success": False,
                "error": str(e)
            }
    
    def should_redo(self, critique_result: Dict) -> bool:
        """Simple decision logic for the orchestrator"""
        return critique_result.get("needs_redo", False) and critique_result.get("score", 100) < 85
