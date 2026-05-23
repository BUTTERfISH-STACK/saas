import ollama
from typing import Optional, Dict, Any, List
import base64
from io import BytesIO
from PIL import Image

class OllamaClient:
    def __init__(self, host: str = "http://localhost:11434"):
        self.client = ollama.Client(host=host)
    
    def chat(self, model: str, messages: List[Dict], stream: bool = False, **kwargs) -> Any:
        """Wrapper for Ollama chat with tool support"""
        return self.client.chat(
            model=model,
            messages=messages,
            stream=stream,
            **kwargs
        )
    
    def generate_vision(self, model: str, prompt: str, image_path: Optional[str] = None, image_base64: Optional[str] = None) -> str:
        """Handle vision models for CV/Computer Vision Agent"""
        messages = [{"role": "user", "content": prompt}]
        
        if image_path:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            messages[0]["images"] = [image_data]
        elif image_base64:
            messages[0]["images"] = [image_base64]
        
        response = self.client.chat(model=model, messages=messages)
        return response["message"]["content"]
    
    def list_models(self) -> List[Dict]:
        try:
            models = self.client.list()
            return models.get("models", [])
        except Exception:
            return []
    
    def is_available(self) -> bool:
        try:
            self.client.list()
            return True
        except:
            return False
