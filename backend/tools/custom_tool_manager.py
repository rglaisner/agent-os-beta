import os
import sqlite3
import time
from crewai.tools import BaseTool
from pydantic import BaseModel

# Database to store custom tools
DB_PATH = "tools.db"

def init_tool_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS custom_tools
                 (name TEXT PRIMARY KEY, description TEXT, code TEXT)''')
    conn.commit()
    conn.close()

init_tool_db()

class ToolCreatorTool(BaseTool):
    name: str = "Tool Creator"
    description: str = "Create a new Python tool for future use. Input: JSON string with 'name', 'description', and 'python_code'. The code must define a class inheriting from BaseTool with a _run method."

    def _run(self, input_str: str) -> str:
        try:
            # Simple parsing (robust JSON parsing would be better)
            # Input expected: {"name": "MyTool", "description": "Does X", "python_code": "..."}
            import json
            data = json.loads(input_str)

            name = data.get('name')
            desc = data.get('description')
            code = data.get('python_code')

            if not name or not code:
                return "Error: Missing name or code."

            # Basic Validation: Check if code compiles
            compile(code, "<string>", "exec")

            # Save to DB
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO custom_tools (name, description, code) VALUES (?, ?, ?)", (name, desc, code))
            conn.commit()
            conn.close()

            return f"Tool '{name}' created and saved successfully. It will be available in the next mission."

        except Exception as e:
            return f"Error creating tool: {str(e)}"

def load_custom_tools():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name, description, code FROM custom_tools")
    rows = c.fetchall()
    conn.close()

    loaded_tools = []
    for name, desc, code in rows:
        try:
            # We need to dynamically execute this code and extract the class
            local_vars = {}
            exec(code, {"BaseTool": BaseTool}, local_vars)

            # Find the class that inherits from BaseTool
            tool_class = None
            for item in local_vars.values():
                if isinstance(item, type) and issubclass(item, BaseTool) and item is not BaseTool:
                    tool_class = item
                    break

            if tool_class:
                # Instantiate
                loaded_tools.append(tool_class())
        except Exception as e:
            print(f"Failed to load custom tool {name}: {e}")

    return loaded_tools
