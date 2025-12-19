import asyncio
import time
from typing import Dict, Any, Optional, List
from fastapi import WebSocket
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from database import add_event

class WebSocketHandler(BaseCallbackHandler):
    def __init__(self, websocket: WebSocket, mission_id: int, default_model: str = "default"):
        self.websocket = websocket
        self.mission_id = mission_id
        self.default_model = default_model
        # Capture the main loop where this handler is created (usually the main thread)
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = asyncio.get_event_loop()

        # Token Tracking (Global accumulators for display)
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_cost = 0.0

        # Incremental Tracking (to attribute cost to specific models)
        self.processed_input_tokens = 0
        self.processed_output_tokens = 0

        # Pricing (USD per 1M tokens)
        self.pricing = {
            "default": {"input": 0.10, "output": 0.40}, # Gemini 2.0 Flash
            "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
            "gemini-1.5-pro": {"input": 3.50, "output": 10.50} # Fallback
        }

    def _calculate_incremental_cost(self, delta_input: int, delta_output: int, model_name: str = "default"):
        """Calculates cost for a specific batch of tokens."""
        # Normalize model name for lookup
        model_key = "default"
        if "2.5-pro" in model_name:
            model_key = "gemini-2.5-pro"
        elif "1.5-pro" in model_name:
            model_key = "gemini-1.5-pro"

        prices = self.pricing.get(model_key, self.pricing["default"])

        input_cost = (delta_input / 1_000_000) * prices["input"]
        output_cost = (delta_output / 1_000_000) * prices["output"]
        return input_cost + output_cost

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        # Estimate input tokens
        # 1 token ~= 4 chars
        est_tokens = sum([len(p) for p in prompts]) / 4
        self.input_tokens += est_tokens

        self._safe_send({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"})

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self.output_tokens += 1 # Rough estimate per stream chunk
        self._safe_send({"type": "STREAM", "content": token, "agentName": "Agent"})

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        # Determine the model used for this call
        # Try to find 'manager' tag or other identifiers
        model_name = self.default_model
        tags = kwargs.get('tags') or []
        if 'manager' in tags:
             model_name = "gemini-2.5-pro"

        # Calculate Delta Tokens (tokens generated since last check)
        delta_input = self.input_tokens - self.processed_input_tokens
        delta_output = self.output_tokens - self.processed_output_tokens

        # Ensure non-negative (just in case of async race conditions, though unlikely here)
        delta_input = max(0, delta_input)
        delta_output = max(0, delta_output)

        # Calculate cost for THIS batch
        batch_cost = self._calculate_incremental_cost(delta_input, delta_output, model_name)
        self.total_cost += batch_cost

        # Update processed counters
        self.processed_input_tokens = self.input_tokens
        self.processed_output_tokens = self.output_tokens

        self._safe_send({
            "type": "USAGE",
            "content": {
                "inputTokens": int(self.input_tokens),
                "outputTokens": int(self.output_tokens),
                "totalCost": self.total_cost
            },
            "agentName": "System"
        })

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> None:
        msg = f"Using {serialized.get('name')}"
        add_event(self.mission_id, "Agent", "ACTION", msg)
        self._safe_send({"type": "ACTION", "content": msg, "agentName": "Agent"})

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        add_event(self.mission_id, "System", "OUTPUT", output[:500])
        self._safe_send({"type": "OUTPUT", "content": output, "agentName": "System"})

    def __call__(self, *args, **kwargs):
        """Make the handler callable to satisfy Pydantic/CrewAI validation."""
        pass

    def _safe_send(self, data: Dict[str, Any]):
        try:
            # Check if we are in the main loop or a thread
            try:
                current_loop = asyncio.get_running_loop()
                if current_loop is self.loop:
                    # Same loop (main thread), use create_task
                    self.loop.create_task(self.websocket.send_json(data))
                else:
                    # Different loop? Should not happen often with get_running_loop() unless nested loops
                    # Use run_coroutine_threadsafe
                    asyncio.run_coroutine_threadsafe(self.websocket.send_json(data), self.loop)
            except RuntimeError:
                # No running loop (we are in a thread), use run_coroutine_threadsafe
                asyncio.run_coroutine_threadsafe(self.websocket.send_json(data), self.loop)

        except Exception as e:
            print(f"WS Error: {e}")
