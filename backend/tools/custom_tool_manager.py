import os
import sqlite3
import time
import re
import ast
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

def _validate_tool_code(code: str) -> tuple[bool, str]:
    """Validate tool code for security and structure."""
    # Block dangerous imports and operations
    dangerous_patterns = [
        (r'import\s+os\s*$', 'os module'),
        (r'import\s+sys\s*$', 'sys module'),
        (r'import\s+subprocess\s*$', 'subprocess module'),
        (r'from\s+os\s+import', 'os module'),
        (r'from\s+sys\s+import', 'sys module'),
        (r'__import__', '__import__ function'),
        (r'eval\s*\(', 'eval function'),
        (r'exec\s*\(', 'exec function'),
        (r'open\s*\(', 'open function'),
        (r'file\s*\(', 'file function'),
        (r'input\s*\(', 'input function'),
        (r'raw_input\s*\(', 'raw_input function'),
    ]
    
    for pattern, desc in dangerous_patterns:
        if re.search(pattern, code, re.MULTILINE | re.IGNORECASE):
            return False, f"Code contains prohibited operation: {desc}"
    
    # Validate code structure - must contain a class inheriting from BaseTool
    try:
        tree = ast.parse(code)
        has_base_tool_class = False
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                for base in node.bases:
                    if isinstance(base, ast.Name) and base.id == 'BaseTool':
                        has_base_tool_class = True
                        # Check for _run method
                        has_run_method = any(
                            isinstance(item, ast.FunctionDef) and item.name == '_run'
                            for item in node.body
                        )
                        if not has_run_method:
                            return False, "Tool class must define a _run method"
        if not has_base_tool_class:
            return False, "Code must define a class inheriting from BaseTool"
    except SyntaxError as e:
        return False, f"Syntax error: {str(e)}"
    
    return True, ""

class ToolCreatorTool(BaseTool):
    name: str = "Tool Creator"
    description: str = "Create a new Python tool for future use. Input: JSON string with 'name', 'description', and 'python_code'. The code must define a class inheriting from BaseTool with a _run method."

    def _run(self, input_str: str) -> str:
        conn = None
        try:
            # Robust JSON parsing
            import json
            data = json.loads(input_str)

            name = data.get('name')
            desc = data.get('description')
            code = data.get('python_code')

            if not name or not code:
                return "Error: Missing name or code."

            # Validate name (prevent injection)
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
                return "Error: Tool name must be a valid Python identifier."

            # Validate code structure and security
            is_valid, error_msg = _validate_tool_code(code)
            if not is_valid:
                return f"Error: {error_msg}"

            # Basic Validation: Check if code compiles
            compile(code, "<string>", "exec")

            # Save to DB with proper error handling
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO custom_tools (name, description, code) VALUES (?, ?, ?)", (name, desc, code))
            conn.commit()

            return f"Tool '{name}' created and saved successfully. It will be available in the next mission."

        except json.JSONDecodeError as e:
            return f"Error: Invalid JSON format: {str(e)}"
        except SyntaxError as e:
            return f"Error: Code syntax error: {str(e)}"
        except Exception as e:
            return f"Error creating tool: {str(e)}"
        finally:
            if conn:
                conn.close()

def load_custom_tools():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT name, description, code FROM custom_tools")
        rows = c.fetchall()

        loaded_tools = []
        for name, desc, code in rows:
            try:
                # Validate before loading
                is_valid, error_msg = _validate_tool_code(code)
                if not is_valid:
                    print(f"Failed to load custom tool {name}: {error_msg}")
                    continue
                
                # Restricted execution environment
                restricted_globals = {
                    '__builtins__': {
                        'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'float', 
                        'int', 'len', 'list', 'max', 'min', 'range', 'round', 
                        'sorted', 'str', 'sum', 'tuple', 'zip', 'print', 'isinstance',
                        'type', 'hasattr', 'getattr', 'setattr'
                    },
                    'BaseTool': BaseTool
                }
                
                # Execute code in restricted environment
                local_vars = {}
                exec(code, restricted_globals, local_vars)

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
    except Exception as e:
        print(f"Error loading custom tools: {e}")
        return []
    finally:
        if conn:
            conn.close()
