import time
import asyncio
from typing import Dict, Any
from crewai.tools import BaseTool
import yfinance as yf

# Global store for human input
human_input_store = {}

class CustomYahooFinanceTool(BaseTool):
    name: str = "Yahoo Finance Tool"
    description: str = "Get stock price. Input: ticker (e.g. 'AAPL')."
    def _run(self, ticker: str) -> str:
        try:
            return f"${yf.Ticker(ticker.strip()).info.get('currentPrice', 'Unknown')}"
        except: return "Error."

class WebHumanInputTool(BaseTool):
    name: str = "Ask Human"
    description: str = "Ask user for input."
    websocket: Any = None
    human_input_store: Dict[str, str] = {}

    def _run(self, question: str) -> str:
        if not self.websocket:
            return "Error: No WebSocket connection available for human input."

        req_id = f"req_{int(time.time())}"
        # Get the event loop from the websocket's context
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Use run_coroutine_threadsafe to send from sync context
        asyncio.run_coroutine_threadsafe(
            self.websocket.send_json({"type": "HUMAN_INPUT_REQUEST", "requestId": req_id, "content": question}),
            loop
        )

        # Wait for response
        while req_id not in self.human_input_store:
            time.sleep(1)

        return self.human_input_store.pop(req_id)

from langchain_experimental.tools import PythonREPLTool
from pydantic import PrivateAttr

class WrapperPythonREPLTool(BaseTool):
    name: str = "python_repl"
    description: str = "A Python shell. Use this to execute python commands. Input should be a valid python command. If you want to see the output of a value, you should print it out with `print(...)`."
    _python_repl: PythonREPLTool = PrivateAttr()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._python_repl = PythonREPLTool()

    def _run(self, command: str) -> str:
        try:
            return self._python_repl.run(command)
        except Exception as e:
            return f"Error executing python code: {e}"
