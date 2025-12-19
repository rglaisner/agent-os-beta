import os
import sys
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

def validate_environment():
    """
    Validate required environment variables on startup.
    Returns True if all required vars are present, False otherwise.
    """
    required_vars = {
        "GEMINI_API_KEY": "Google Gemini API key is required for LLM operations"
    }
    
    missing = []
    for var, description in required_vars.items():
        if not os.getenv(var) or not os.getenv(var).strip():
            missing.append(f"{var}: {description}")
    
    if missing:
        print("=" * 60)
        print("ERROR: Missing required environment variables:")
        for msg in missing:
            print(f"  - {msg}")
        print("=" * 60)
        print("\nPlease set the required environment variables and restart the server.")
        return False
    
    return True

