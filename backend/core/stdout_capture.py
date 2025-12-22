import sys
import asyncio
import re
from fastapi import WebSocket


class StdoutInterceptor:
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        self.websocket = websocket
        self.loop = loop
        self.original_stdout = sys.stdout
        # Regex to strip ANSI escape codes
        self.ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

        # Filters to suppress specific lines
        self.filters = [
            "Traceback (most recent call last)",
            "Error: File not found",
            "[CrewAIEventsBus] Sync handler error",
        ]

    def write(self, message: str):
        # Always write to original stdout (server logs)
        self.original_stdout.write(message)

        # Filter for WebSocket
        if not message:
            return

        # Check filters
        for f in self.filters:
            if f in message:
                return

        # Strip ANSI codes for frontend display
        clean_message = self.ansi_escape.sub("", message)

        if not clean_message.strip() and not "\n" in clean_message:
            # Skip empty content that isn't just a newline (newlines are important for formatting)
            # Actually, let's just send it. Even whitespace matters for ASCII art.
            pass

        if clean_message:
            try:
                # Send to WS
                payload = {"type": "TERMINAL", "content": clean_message}
                asyncio.run_coroutine_threadsafe(
                    self.websocket.send_json(payload), self.loop
                )
            except Exception:
                # If WS fails, don't crash the server output
                pass

    def flush(self):
        self.original_stdout.flush()

    def start(self):
        sys.stdout = self

    def stop(self):
        sys.stdout = self.original_stdout
