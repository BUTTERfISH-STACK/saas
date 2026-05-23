from pydantic import BaseModel, Field
from typing import Optional, List, Any, Literal
from datetime import datetime

class TaskState(BaseModel):
    task_id: str
    user_goal: str
    original_input: Any = None
    vision_output: Optional[dict] = None
    current_draft: Optional[str] = None
    critique_history: List[dict] = Field(default_factory=list)
    final_output: Optional[str] = None
    iterations: int = 0
    max_iterations: int = 3
    status: Literal["pending", "processing", "completed", "failed"] = "pending"

class VisionRequest(BaseModel):
    image_base64: Optional[str] = None  # For future base64 support
    prompt: str = "Extract all text and structure from this resume image or scanned document as accurately as possible."

class CritiqueRequest(BaseModel):
    draft: str
    original_context: str
    rules: List[str] = Field(default_factory=lambda: [
        "Be completely truthful - never invent experience, titles, dates, or metrics",
        "Use strong action verbs and add quantification where possible",
        "Optimize for ATS keyword matching based on any provided job context",
        "Ensure clean, professional formatting suitable for resumes"
    ])

class AgentResponse(BaseModel):
    success: bool
    data: Any = None
    message: str = ""
    iterations: int = 0
    critique_feedback: Optional[str] = None
