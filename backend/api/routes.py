import os
import json
import time
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from langchain_google_genai import ChatGoogleGenerativeAI
from core.models import PlanRequest
from tools.rag import add_document_to_kb, list_documents, delete_document_by_source, search_documents
from pydantic import BaseModel

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
            reader = pypdf.PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        else:
            # Assume text/code
            with open(file_path, "r", errors='ignore') as f:
                text = f.read()

        if not text.strip():
            raise HTTPException(400, "Could not extract text from file.")

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

    # Using 1.5-flash as 2.5 is not yet standard/available in this SDK context
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

    1. Determine the best execution mode: 'sequential' (linear steps) or 'hierarchical' (complex tasks needing a manager).
    2. Create a step-by-step plan.

    Return ONLY a JSON object:
    {{
      "suggested_mode": "sequential" | "hierarchical",
      "reasoning": "Why you chose this mode (short explanation)",
      "plan": [{{ "id": "step-1", "agentId": "agent-id", "instruction": "Step details" }}]
    }}
    """
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, str(e))
