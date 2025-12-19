import matplotlib
matplotlib.use('Agg') # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import os
import time
import re
from crewai.tools import BaseTool

# Ensure plots directory exists
PLOTS_DIR = "static/plots"
os.makedirs(PLOTS_DIR, exist_ok=True)

# Restricted builtins for safer execution
SAFE_BUILTINS = {
    'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'float', 'int', 'len',
    'list', 'max', 'min', 'range', 'round', 'sorted', 'str', 'sum', 'tuple',
    'zip', 'print'
}

class DataVisualizationTool(BaseTool):
    name: str = "Data Visualization Tool"
    description: str = "Generate charts/plots from data. Input: a Python script string that defines variables 'x' and 'y' (lists/arrays) and optionally 'title', 'xlabel', 'ylabel'. It can also use pandas dataframe 'df'. DO NOT show() the plot."

    def _validate_script(self, script: str) -> tuple[bool, str]:
        """Validate script for dangerous operations."""
        # Block dangerous imports and operations
        dangerous_patterns = [
            r'import\s+os\s*$',
            r'import\s+sys\s*$',
            r'import\s+subprocess\s*$',
            r'__import__',
            r'eval\s*\(',
            r'exec\s*\(',
            r'open\s*\(',
            r'file\s*\(',
            r'input\s*\(',
            r'raw_input\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, script, re.MULTILINE | re.IGNORECASE):
                return False, f"Script contains prohibited operation: {pattern}"
        
        return True, ""

    def _run(self, script: str) -> str:
        plt_figure = None
        try:
            # Clean script
            script = script.replace("```python", "").replace("```", "").strip()
            
            # Validate script
            is_valid, error_msg = self._validate_script(script)
            if not is_valid:
                return f"Error: {error_msg}"

            # Restricted execution environment
            restricted_globals = {
                '__builtins__': {k: __builtins__[k] for k in SAFE_BUILTINS if k in __builtins__},
                'plt': plt,
                'sns': sns,
                'pd': __import__('pandas'),
                'np': __import__('numpy'),
            }
            
            # Execution context
            local_vars = {}
            exec(script, restricted_globals, local_vars)

            # Check for data
            if 'df' in local_vars:
                # Support Seaborn if df is present
                # This is a bit magic, but let's try to infer or let user specify type
                pass

            plt_figure = plt.figure(figsize=(10, 6))

            # Basic Plotting Logic
            if 'x' in local_vars and 'y' in local_vars:
                sns.lineplot(x=local_vars['x'], y=local_vars['y'])
            elif 'df' in local_vars:
                 # Try to plot all numeric cols if no specific instructions (fallback)
                 sns.lineplot(data=local_vars['df'])
            else:
                if plt_figure:
                    plt.close(plt_figure)
                return "Error: Script must define 'x' and 'y' lists OR a pandas 'df'."

            if 'title' in local_vars: plt.title(local_vars['title'])
            if 'xlabel' in local_vars: plt.xlabel(local_vars['xlabel'])
            if 'ylabel' in local_vars: plt.ylabel(local_vars['ylabel'])

            # Save
            filename = f"plot_{int(time.time())}.png"
            filepath = os.path.join(PLOTS_DIR, filename)
            plt.savefig(filepath)
            plt.close(plt_figure)
            plt_figure = None

            # Return URL (Relative to backend root, handled by static mount)
            # Assuming backend is on localhost:8000 for now, or just return relative path
            return f"Chart created: /static/plots/{filename}"

        except Exception as e:
            if plt_figure:
                plt.close(plt_figure)
            return f"Error plotting: {str(e)}"
