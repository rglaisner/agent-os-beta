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
        asyncio.run(self.websocket.send_json({"type": "HUMAN_INPUT_REQUEST", "requestId": req_id, "content": question}))

        # Wait for response
        while req_id not in self.human_input_store:
            time.sleep(1)

        return self.human_input_store.pop(req_id)
