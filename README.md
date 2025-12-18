# Agent OS: Autonomous AI Agent Team Platform

**Agent OS** is a powerful, local-first platform for orchestrating teams of autonomous AI agents to accomplish complex tasks. Built with **CrewAI**, **LangChain**, and **FastAPI**, it provides a modern React-based "Mission Control" interface to design, monitor, and manage your digital workforce.

## 🚀 Key Features

*   **Mission Control**: a natural language interface to define high-level goals. The system automatically generates a step-by-step execution plan.
*   **Orchestration Modes**:
    *   **Sequential**: Agents execute tasks in a linear, pre-determined order.
    *   **Hierarchical**: A "Manager" agent (powered by Gemini 2.5 Pro) dynamically delegates tasks and oversees execution.
*   **Knowledge Base (RAG)**: Drag-and-drop file uploads (PDF, Text) and manual entry to build a persistent long-term memory for your agents using ChromaDB.
*   **Customizable Workforce**: Create and edit agents with specific Roles, Goals, Backstories, and Toolsets.
*   **Live Monitoring**: Watch agent "thoughts" and actions stream in real-time via WebSockets.
*   **Tool Ecosystem**: Includes Google Search, Website Scraping, Yahoo Finance, Python REPL, Data Visualization, and more.
*   **Human-in-the-Loop**: Agents can pause execution to ask the user for clarifying input or decisions.

## 🛠️ Architecture

*   **Backend**: Python 3.10+
    *   **FastAPI**: API and WebSocket server.
    *   **CrewAI**: Multi-agent orchestration framework.
    *   **LangChain Google GenAI**: LLM integration (Gemini 2.0 Flash & 2.5 Pro).
    *   **SQLite**: Persistence for missions and tools.
    *   **ChromaDB**: Vector database for RAG (Knowledge Base).
*   **Frontend**: Node.js & React
    *   **Vite**: Build tool and dev server.
    *   **Tailwind CSS**: Styling.
    *   **Lucide React**: Iconography.

## 📋 Prerequisites

Before running the application, ensure you have the following installed:

1.  **Python 3.10 or higher**: [Download Python](https://www.python.org/downloads/)
2.  **Node.js (v18+) & npm**: [Download Node.js](https://nodejs.org/)
3.  **Google Gemini API Key**: Get one from [Google AI Studio](https://aistudio.google.com/)

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository_url>
cd <repository_folder>
```

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment.

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Note**: You must have a valid `GEMINI_API_KEY` set in your environment variables.
```bash
# Linux/macOS
export GEMINI_API_KEY="your_api_key_here"

# Windows (Command Prompt)
set GEMINI_API_KEY=your_api_key_here
```

### 3. Frontend Setup
Open a new terminal, navigate to the project root, and install frontend dependencies.

```bash
# From the project root
npm install
```

## ▶️ Running the Application

You need to run both the backend and frontend simultaneously (in separate terminals).

**Terminal 1: Backend**
```bash
cd backend
source venv/bin/activate  # Or venv\Scripts\activate on Windows
python main.py
```
*The backend will start on `http://localhost:8000`.*

**Terminal 2: Frontend**
```bash
# From the project root
npm run dev
```
*The frontend will start on `http://localhost:5173` (or similar).*

Open your browser and navigate to the frontend URL to access Agent OS.

## 📖 User Guide

### 1. Mission Control (The "Setup" Tab)
This is your command center.
*   **Mission Goal**: Type what you want to achieve (e.g., "Research the latest trends in AI and write a blog post").
*   **Generate Plan**: Click this button. The system will use an LLM to break your goal into actionable steps and assign them to agents.
*   **Team Structure**:
    *   Select **Sequential** for a simple, linear workflow.
    *   Select **Hierarchy** for complex tasks where a Manager agent should coordinate the team.
*   **Attachments**: Upload files (PDF, CSV, etc.) that agents might need to analyze.
*   **Launch Mission**: Once you are happy with the plan, click Launch to start the agents.

### 2. Managing Agents
On the left sidebar (desktop) or top menu, you can see your roster of agents.
*   **Add Agent**: Click the `+` button to create a new agent. Give them a Role, Goal, and Backstory.
*   **Edit Agent**: Click the pencil icon on an agent card to modify their tools or personality.
*   **Tools**: Assign tools like "Google Search" or "Python Calculator" to empower your agents.

### 3. Knowledge Base
Navigate to the "Knowledge" tab to manage long-term memory.
*   **Upload Document**: Drag and drop PDF or Text files to ingest them into the vector database.
*   **Manual Entry**: Paste text directly (e.g., meeting notes, raw data) and give it a source name.
*   **Search**: Use the search bar to verify what information is currently stored.
*   *Agents with the "Knowledge Base" tool enabled can query this data during missions.*

### 4. Live Monitoring
Once a mission starts, you will be taken to the "Monitor" tab.
*   **Live Feed**: Watch the agents' thought process, tool usage, and final answers streaming in real-time.
*   **Human Input**: If an agent asks a question, a prompt will appear for you to provide an answer.
*   **Usage**: Track token usage and estimated cost in the footer.

## ❓ Troubleshooting

*   **"WebSocket Error" or "Backend failed"**: Ensure the backend server is running (`python main.py`) and is accessible at `localhost:8000`. Check if the `VITE_BACKEND_URL` environment variable is set correctly if you are running on a custom port.
*   **"Missing API Key"**: The backend logs or WebSocket message will complain if `GEMINI_API_KEY` is missing. Ensure you exported it in the terminal running the backend.
*   **"Upload failed"**: Ensure the `backend/uploads` directory exists (it is created automatically on startup) and has write permissions.

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request.
