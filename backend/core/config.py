import os
from typing import Set

# LLM Configuration
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini/gemini-2.0-flash")
MANAGER_MODEL = os.getenv("MANAGER_MODEL", "gemini/gemini-2.5-pro")

# Gemini Safety Settings - BLOCK_NONE to prevent silent failures
GEMINI_SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

# API Key Validation
WARNED_MISSING_KEYS: Set[str] = set()

def check_api_key(key_name: str, tool_name: str) -> bool:
    """
    Checks if an API key exists in the environment.
    Warns only once if missing.
    """
    if key_name in os.environ and os.environ[key_name].strip():
        return True

    if key_name not in WARNED_MISSING_KEYS:
        print(f"Warning: {key_name} not found or empty. {tool_name} skipped.")
        WARNED_MISSING_KEYS.add(key_name)
    return False

def ensure_openai_key():
    """
    Ensure OpenAI Key is set to avoid validation errors for tools that default to it.
    This is a known workaround for CrewAI.
    """
    if "OPENAI_API_KEY" not in os.environ:
        os.environ["OPENAI_API_KEY"] = "NA"
