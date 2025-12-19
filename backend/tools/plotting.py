import matplotlib
matplotlib.use('Agg') # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import os
import time
from crewai.tools import BaseTool

# Ensure plots directory exists
PLOTS_DIR = "static/plots"
os.makedirs(PLOTS_DIR, exist_ok=True)

class DataVisualizationTool(BaseTool):
    name: str = "Data Visualization Tool"
    description: str = "Generate charts/plots from data. Input: a Python script string that defines variables 'x' and 'y' (lists/arrays) and optionally 'title', 'xlabel', 'ylabel'. It can also use pandas dataframe 'df'. DO NOT show() the plot."

    def _run(self, script: str) -> str:
        try:
            # Clean script
            script = script.replace("```python", "").replace("```", "").strip()

            # Execution context
            local_vars = {}
            exec(script, {}, local_vars)

            # Check for data
            if 'df' in local_vars:
                # Support Seaborn if df is present
                # This is a bit magic, but let's try to infer or let user specify type
                pass

            plt.figure(figsize=(10, 6))

            # Basic Plotting Logic
            if 'x' in local_vars and 'y' in local_vars:
                sns.lineplot(x=local_vars['x'], y=local_vars['y'])
            elif 'df' in local_vars:
                 # Try to plot all numeric cols if no specific instructions (fallback)
                 sns.lineplot(data=local_vars['df'])
            else:
                return "Error: Script must define 'x' and 'y' lists OR a pandas 'df'."

            if 'title' in local_vars: plt.title(local_vars['title'])
            if 'xlabel' in local_vars: plt.xlabel(local_vars['xlabel'])
            if 'ylabel' in local_vars: plt.ylabel(local_vars['ylabel'])

            # Save
            filename = f"plot_{int(time.time())}.png"
            filepath = os.path.join(PLOTS_DIR, filename)
            plt.savefig(filepath)
            plt.close()

            # Return URL (Relative to backend root, handled by static mount)
            # Assuming backend is on localhost:8000 for now, or just return relative path
            return f"Chart created: /static/plots/{filename}"

        except Exception as e:
            plt.close()
            return f"Error plotting: {str(e)}"
