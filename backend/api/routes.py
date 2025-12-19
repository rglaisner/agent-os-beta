import os
import json
import time
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from langchain_google_genai import ChatGoogleGenerativeAI
from core.models import PlanRequest
from tools.rag import (
    add_document_to_kb, list_documents, delete_document_by_source, search_documents,
    semantic_search_with_expansion, summarize_document, get_knowledge_base_health
)
from pydantic import BaseModel
from core.database import get_missions, get_mission

router = APIRouter()

class KnowledgeUpload(BaseModel):
    text: str
    source: str

class KnowledgeSearch(BaseModel):
    query: str

@router.post("/knowledge")
async def add_knowledge(data: KnowledgeUpload):
    try:
        add_document_to_kb(data.text, data.source)
        return {"status": "success", "message": f"Added {data.source} to Knowledge Base"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...)):
    try:
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{file.filename}"
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Extract Text based on extension
        text = ""
        if file.filename.endswith(".pdf"):
            import pypdf
            try:
                reader = pypdf.PdfReader(file_path)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            except Exception as e:
                raise HTTPException(400, f"Failed to read PDF: {str(e)}")
        else:
            # Try UTF-8 first, then fallback to latin-1, then error
            encodings = ['utf-8', 'latin-1', 'cp1252']
            text = None
            for encoding in encodings:
                try:
                    with open(file_path, "r", encoding=encoding) as f:
                        text = f.read()
                    break
                except UnicodeDecodeError:
                    continue
            
            if text is None:
                raise HTTPException(400, "Could not decode file text. Please ensure file is UTF-8 encoded.")

        if not text.strip():
            raise HTTPException(400, "Could not extract text from file or file is empty.")

        add_document_to_kb(text, file.filename)
        return {"status": "success", "message": f"Indexed {file.filename}"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/knowledge")
async def get_knowledge():
    return {"documents": list_documents()}

@router.delete("/knowledge/{source_name}")
async def delete_knowledge(source_name: str):
    success = delete_document_by_source(source_name)
    if not success:
        raise HTTPException(500, "Failed to delete document")
    return {"status": "success", "message": f"Deleted {source_name}"}

@router.post("/knowledge/search")
async def search_knowledge(data: KnowledgeSearch):
    results = search_documents(data.query)
    return {"results": results}

@router.post("/knowledge/search/semantic")
async def semantic_search(data: KnowledgeSearch):
    """Semantic search with query expansion."""
    results = semantic_search_with_expansion(data.query)
    return {"results": results}

@router.post("/knowledge/summarize")
async def summarize_knowledge(data: KnowledgeUpload):
    """Automatically summarize a document."""
    summary = summarize_document(data.text)
    return {"summary": summary}

@router.get("/knowledge/health")
async def knowledge_health():
    """Get knowledge base health metrics."""
    health = get_knowledge_base_health()
    return health

@router.get("/knowledge/graph")
async def knowledge_graph():
    """Get knowledge graph visualization data."""
    # Simplified knowledge graph - in production, use proper graph database
    collection = get_collection()
    data = collection.get(include=['metadatas', 'documents'])
    
    nodes = []
    edges = []
    source_map = {}
    
    for i, metadata in enumerate(data.get('metadatas', [])):
        if metadata and 'source' in metadata:
            source = metadata['source']
            if source not in source_map:
                source_map[source] = len(nodes)
                nodes.append({"id": source, "label": source, "type": "document"})
    
    # Simple edge creation based on shared keywords (simplified)
    # In production, use proper entity extraction and relationship detection
    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes)
    }

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handles uploading large files (PDF, CSV, Excel)"""
    try:
        os.makedirs("uploads", exist_ok=True)
        file_ext = os.path.splitext(file.filename)[1]
        safe_name = f"doc_{int(time.time())}{file_ext}"
        file_path = os.path.join("uploads", safe_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"filename": file.filename, "server_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/plan")
async def generate_plan(request: PlanRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: raise HTTPException(500, "Missing API Key")

    # Using gemini-2.0-flash for plan generation
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.7)

    agent_desc = "\n".join([f"- {a['role']} (Tools: {a['toolIds']})" for a in request.agents])

    # Updated prompt to handle process type
    process_instruction = ""
    if request.process_type == "hierarchical":
        process_instruction = "The user has requested a HIERARCHICAL process. You should assume a Manager Agent will oversee these agents. Design the steps as high-level directives that the Manager can delegate."

    prompt = f"""
    You are an expert project manager. Analyze the request: "{request.goal}"
    Available Agents:
    {agent_desc}
    {process_instruction}

    If the available agents are insufficient to complete the goal, you MUST suggest new agents.
    Assess if agents need training iterations (especially for low-context tasks). Default is 0.

    Create a JSON object with the following structure:
    {{
      "narrative": "A strategic summary of the plan (2-3 sentences). Explain WHY this strategy was chosen.",
      "plan": [
          {{ "id": "step-1", "agentId": "agent-id", "instruction": "Step details", "trainingIterations": 0 }}
      ],
      "newAgents": [
          {{ "id": "unique-id", "role": "Specific Role Name", "goal": "Detailed Goal", "backstory": "Detailed Backstory", "toolIds": ["tool-id", ...], "humanInput": false }}
      ],
      "agentConfigs": {{
          "agent_id": {{ "reasoning": true, "max_reasoning_attempts": 5, "max_iter": 30 }}
      }}
    }}

    IMPORTANT:
    - If you create "newAgents", ensure the 'role' is descriptive (e.g., "Market Research Specialist" NOT "AGENT").
    - "agentConfigs": Set "reasoning": true if the agent needs to perform complex logical reasoning (delegation).
    - Available Tools: tool-search, tool-scrape, tool-finance, tool-python, tool-rag, tool-plot.

    Return ONLY the JSON object.
    """
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        # Normalize response if LLM returns just a list (legacy behavior fallback)
        if isinstance(data, list):
            return {"plan": data, "newAgents": [], "agentConfigs": {}, "narrative": "Legacy Plan Generated."}

        # Normalize plan step IDs to strings (in case LLM returns numbers)
        if "plan" in data and isinstance(data["plan"], list):
            for step in data["plan"]:
                if "id" in step and not isinstance(step["id"], str):
                    step["id"] = f"step-{step['id']}"

        # Ensure agentConfigs exists
        if "agentConfigs" not in data:
            data["agentConfigs"] = {}

        if "narrative" not in data:
            data["narrative"] = "No strategy narrative provided."

        return data
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/missions")
async def list_missions():
    try:
        missions = get_missions()
        # Serialize SQLAlchemy objects to dicts
        missions_list = [
            {
                "id": m.id,
                "goal": m.goal,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "estimated_cost": m.estimated_cost,
                "total_tokens": m.total_tokens
            }
            for m in missions
        ]
        return {"missions": missions_list}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/missions/{mission_id}")
async def get_mission_details(mission_id: int):
    mission = get_mission(mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found")
    # Serialize SQLAlchemy object to dict
    return {
        "id": mission.id,
        "goal": mission.goal,
        "status": mission.status,
        "created_at": mission.created_at.isoformat() if mission.created_at else None,
        "result": mission.result,
        "estimated_cost": mission.estimated_cost,
        "total_tokens": mission.total_tokens
    }
