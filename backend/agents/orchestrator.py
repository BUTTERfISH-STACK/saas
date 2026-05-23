from backend.ollama_client import OllamaClient
from backend.agents.vision_agent import VisionAgent
from backend.agents.corrective_agent import CorrectiveAgent
from backend.schemas import TaskState, VisionRequest, CritiqueRequest, AgentResponse
import uuid
from typing import Optional

class AgentOrchestrator:
    """Central intelligence orchestrator that routes tasks to specialized agents"""
    
    def __init__(self):
        self.ollama = OllamaClient()
        self.vision_agent = VisionAgent(self.ollama)
        self.corrective_agent = CorrectiveAgent(self.ollama)
        self.main_model = "llama3.1:8b"  # Primary reasoning model for VellonCVs tasks
    
    def create_task(self, user_goal: str, original_input: Optional[dict] = None) -> TaskState:
        return TaskState(
            task_id=str(uuid.uuid4()),
            user_goal=user_goal,
            original_input=original_input or {},
            status="pending"
        )
    
    def process_resume_optimization(
        self, 
        task: TaskState, 
        resume_text_or_image: Optional[str] = None,
        image_path: Optional[str] = None,
        job_description: Optional[str] = None
    ) -> AgentResponse:
        """Full pipeline: Vision (if needed) → Main generation → Corrective redo loop"""
        
        task.status = "processing"
        
        # Step 1: Vision processing if image provided
        if image_path or (resume_text_or_image and resume_text_or_image.startswith("data:image")):
            vision_req = VisionRequest(prompt="Extract structured resume content from this document/image.")
            vision_result = self.vision_agent.process_resume_image(vision_req, image_path=image_path)
            task.vision_output = vision_result
            context = vision_result.get("extracted_text", "")
        else:
            context = resume_text_or_image or str(task.original_input)
        
        # Step 2: Initial generation with main model
        initial_prompt = self._build_optimization_prompt(context, task.user_goal, job_description)
        
        try:
            response = self.ollama.chat(
                model=self.main_model,
                messages=[{"role": "user", "content": initial_prompt}]
            )
            task.current_draft = response["message"]["content"]
        except Exception as e:
            task.status = "failed"
            return AgentResponse(success=False, message=str(e))
        
        # Step 3: Iterative Corrective Agent loop (Redo)
        for i in range(task.max_iterations):
            task.iterations = i + 1
            
            critique_req = CritiqueRequest(
                draft=task.current_draft,
                original_context=context,
                rules=[
                    "Never invent facts, experience, titles, companies, dates or metrics",
                    "Use powerful action verbs and quantify achievements",
                    "Align language with any provided job description",
                    "Ensure ATS-friendly structure and keyword usage"
                ]
            )
            
            critique = self.corrective_agent.critique_output(critique_req)
            task.critique_history.append(critique)
            
            if not self.corrective_agent.should_redo(critique):
                break  # Good enough
            
            # Redo with feedback
            redo_prompt = f"""Previous draft:
{task.current_draft}

Critique feedback:
{critique.get('feedback', '')}

Issues found: {', '.join(critique.get('issues', []))}

Please rewrite an improved version addressing all feedback while staying 100% truthful to the original material."""

            try:
                new_response = self.ollama.chat(
                    model=self.main_model,
                    messages=[{"role": "user", "content": redo_prompt}]
                )
                task.current_draft = new_response["message"]["content"]
            except:
                break
        
        task.final_output = task.current_draft
        task.status = "completed"
        
        return AgentResponse(
            success=True,
            data={
                "final_output": task.final_output,
                "iterations": task.iterations,
                "critique_history": task.critique_history,
                "vision_used": task.vision_output is not None
            },
            iterations=task.iterations,
            critique_feedback=task.critique_history[-1].get("feedback") if task.critique_history else None
        )
    
    def _build_optimization_prompt(self, context: str, goal: str, job_desc: Optional[str] = None) -> str:
        jd_section = f"\n\nTarget Job Description:\n{job_desc}" if job_desc else ""
        
        return f"""You are VellonCVs — an expert private AI career coach specializing in ATS-optimized, truthful resume rewriting.

User Goal: {goal}

Original Resume / Context:
{context}
{jd_section}

Instructions:
- Rewrite for maximum impact while remaining 100% truthful
- Use strong action verbs and add metrics where the source supports it
- Optimize for ATS systems and the target role if a job description is provided
- Output clean, professional, well-structured content

Provide the optimized version now:"""
