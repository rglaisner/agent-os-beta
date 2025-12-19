import logging
import asyncio
from fastapi import WebSocket

class WebSocketLoggingHandler(logging.Handler):
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.websocket = websocket
        self.loop = loop

    def emit(self, record):
        try:
            msg = self.format(record)
            # Use SYSTEM type so it shows up in the terminal
            payload = {"type": "SYSTEM", "content": f"{msg}"}
            asyncio.run_coroutine_threadsafe(self.websocket.send_json(payload), self.loop)
        except Exception:
            self.handleError(record)
