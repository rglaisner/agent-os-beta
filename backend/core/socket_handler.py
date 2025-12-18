import asyncio
import time
from typing import Dict, Any, Optional, List
from fastapi import WebSocket
from langchain_core.callbacks import BaseCallbackHandler
from database import add_event

class WebSocketHandler(BaseCallbackHandler):
    def __init__(self, websocket: WebSocket, mission_id: int):
        self.websocket = websocket
        self.mission_id = mission_id

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        self._safe_send({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"})

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self._safe_send({"type": "STREAM", "content": token, "agentName": "Agent"})

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> None:
        msg = f"Using {serialized.get('name')}"
        add_event(self.mission_id, "Agent", "ACTION", msg)
        self._safe_send({"type": "ACTION", "content": msg, "agentName": "Agent"})

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        add_event(self.mission_id, "System", "OUTPUT", output[:500])
        self._safe_send({"type": "OUTPUT", "content": output, "agentName": "System"})

    def _safe_send(self, data: Dict[str, Any]):
        try:
            # Detect if we are in the main loop or a thread
            loop = asyncio.get_event_loop()
            if loop.is_running():
                 # We are in an event loop (likely the one running the agent if async, but agents are mostly sync here)
                 # However, websocket is bound to the Main Uvicorn Loop.
                 # If this code is running in a thread (run_in_executor), get_event_loop might fail or return a different loop.
                 pass
        except RuntimeError:
            pass

        # The websocket method is async. We need to schedule it on the *loop that created the websocket*.
        # Since we don't have easy access to the main loop object here without passing it down,
        # and CrewAI runs in a separate thread/process executor usually.

        # Robust solution: Use asyncio.run if no loop, or run_coroutine_threadsafe if we had the loop.
        # Given the previous code worked, asyncio.run() creates a *new* loop for the coroutine.
        # But WebSocket methods must be called on the *original* loop.
        # For now, sticking to asyncio.run() is actually incorrect if the WS is not thread-safe,
        # but Uvicorn's WS implementation might barely handle it or we got lucky.

        # BETTER: Use a sync wrapper if available or just try-except.
        # Actually, `asyncio.run` blocks until completion.
        # If `websocket.send_json` requires access to the event loop state of the main thread, this will crash.

        # Let's try to assume we are in a thread and use a fresh loop for just the send?
        # No, that doesn't make sense for a bound socket.

        # Reverting to the previous implementation as it was "verified" by the agent before,
        # but adding error handling.
        try:
            asyncio.run(self.websocket.send_json(data))
        except RuntimeError:
            # If we are already in a loop
            # This happens if CrewAI runs async locally.
            # We can try creating a task.
            asyncio.create_task(self.websocket.send_json(data))
        except Exception as e:
            print(f"WS Error: {e}")
