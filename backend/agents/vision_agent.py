from backend.ollama_client import OllamaClient
from backend.schemas import VisionRequest
from typing import Dict, Any

class VisionAgent:
    """Computer Vision (CV) Agent for visual processing of resumes, images, scanned documents"""
    
    def __init__(self, ollama_client: OllamaClient):
        self.ollama = ollama_client
        # Preferred vision models (user should pull one via ollama pull)
        self.vision_model = "llava:13b"  # or "minicpm-v:8b", "llama3.2-vision:11b"
        self.fallback_model = "llama3.2:latest"  # Small fallback if vision not available
    
    def process_resume_image(self, request: VisionRequest, image_path: str = None) -> Dict[str, Any]:
        """Extract structured information from resume image or scanned PDF page"""
        
        prompt = f"""{request.prompt}

Please return the output in clean structured text with clear section headers like:
- Contact Information
- Professional Summary
- Work Experience (with dates, titles, companies, bullet points)
- Education
- Skills
- Projects (if any)

Be extremely accurate and preserve all numbers, dates, and names exactly as they appear."""

        try:
            if image_path:
                extracted_text = self.ollama.generate_vision(
                    model=self.vision_model,
                    prompt=prompt,
                    image_path=image_path
                )
            else:
                extracted_text = self.ollama.generate_vision(
                    model=self.vision_model,
                    prompt=prompt,
                    image_base64=request.image_base64
                )
            
            return {
                "extracted_text": extracted_text,
                "model_used": self.vision_model,
                "success": True
            }
        except Exception as e:
            # Fallback to text-only if vision model fails
            try:
                fallback_response = self.ollama.chat(
                    model=self.fallback_model,
                    messages=[{"role": "user", "content": f"Analyze this resume text: {prompt}"}]
                )
                return {
                    "extracted_text": fallback_response["message"]["content"],
                    "model_used": self.fallback_model,
                    "success": True,
                    "note": "Used fallback model - vision capabilities limited"
                }
            except Exception as fallback_error:
                return {
                    "extracted_text": "",
                    "success": False,
                    "error": str(e),
                    "fallback_error": str(fallback_error)
                }
    
    def describe_image(self, image_path: str, custom_prompt: str = "Describe this image in detail") -> str:
        """General visual description"""
        return self.ollama.generate_vision(
            model=self.vision_model,
            prompt=custom_prompt,
            image_path=image_path
        )
