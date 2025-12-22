import os
import chromadb
from typing import List, Optional, Any, Protocol, Dict
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from datetime import datetime, timedelta
import json

# Newer CrewAI versions may move or remove BaseTool; keep runtime resilient.
try:
    from crewai.tools import BaseTool
except ImportError:  # pragma: no cover - compatibility shim

    class BaseTool(Protocol):
        """Minimal protocol for tool-like objects used by CrewAI."""

        name: str
        description: str

        def _run(self, *args: Any, **kwargs: Any) -> Any:
            ...

# Initialize ChromaDB
# Storing in a local folder 'chroma_db'
chroma_client = chromadb.PersistentClient(path="chroma_db")


def get_embeddings_model():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    return GoogleGenerativeAIEmbeddings(
        model="models/embedding-001", google_api_key=api_key
    )


def get_collection():
    # embedding_function = get_embeddings_model() # Chroma supports custom embedding functions, but it's often easier to embed before adding
    # simpler: use default or manage embeddings manually
    # For simplicity with Langchain integrations, we might use Langchain's Chroma wrapper,
    # but let's stick to raw Chroma client for explicit control if we want, OR use Langchain's VectorStore.
    # Given the requirements, let's use the raw client but generate embeddings using Google.

    return chroma_client.get_or_create_collection(name="agent_knowledge")


class KnowledgeBaseTool(BaseTool):
    name: str = "Knowledge Base Tool"
    description: str = (
        "Search the long-term knowledge base for information. Input: a search query."
    )

    def _run(self, query: str) -> str:
        try:
            collection = get_collection()
            # Generate embedding for query
            embed_model = get_embeddings_model()
            query_embedding = embed_model.embed_query(query)

            results = collection.query(query_embeddings=[query_embedding], n_results=3)

            documents = results["documents"][0]
            metadatas = results["metadatas"][0]

            response = "Found in Knowledge Base:\n"
            for i, doc in enumerate(documents):
                source = metadatas[i].get("source", "Unknown")
                response += f"---\nSource: {source}\nContent: {doc}\n"
            return response
        except Exception as e:
            return f"Error searching knowledge base: {str(e)}"


def add_document_to_kb(text: str, source: str):
    collection = get_collection()
    embed_model = get_embeddings_model()

    # Simple chunking (can be improved)
    chunk_size = 1000
    chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]

    ids = [f"{source}_{i}_{int(os.urandom(4).hex(), 16)}" for i in range(len(chunks))]
    metadatas = [{"source": source} for _ in chunks]
    embeddings = embed_model.embed_documents(chunks)

    collection.add(
        documents=chunks, embeddings=embeddings, metadatas=metadatas, ids=ids
    )


def list_documents():
    collection = get_collection()
    # Chroma doesn't have a direct "list all unique sources" efficiently without scanning
    # For now, we'll return a count or peek.
    # Optimally, we should store document metadata in SQL.
    # But let's try to get all metadata and unique sources.
    try:
        data = collection.get(include=["metadatas"])
        sources = set()
        for m in data["metadatas"]:
            if m and "source" in m:
                sources.add(m["source"])
        return list(sources)
    except:
        return []


def delete_document_by_source(source_name: str):
    """Deletes all chunks associated with a specific source name."""
    collection = get_collection()
    try:
        # chroma delete by where clause
        collection.delete(where={"source": source_name})
        return True
    except Exception as e:
        print(f"Error deleting document {source_name}: {e}")
        return False


def search_documents(query: str, n_results: int = 5):
    """Searches the knowledge base and returns raw results."""
    try:
        collection = get_collection()
        embed_model = get_embeddings_model()
        query_embedding = embed_model.embed_query(query)

        results = collection.query(
            query_embeddings=[query_embedding], n_results=n_results
        )

        output = []
        if results and results["documents"]:
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = (
                results["distances"][0]
                if "distances" in results
                else [0] * len(documents)
            )

            for i, doc in enumerate(documents):
                output.append(
                    {"content": doc, "metadata": metadatas[i], "score": distances[i]}
                )
        return output
    except Exception as e:
        print(f"Error searching documents: {e}")
        return []

def expand_query_semantically(query: str) -> List[str]:
    """Expand a query semantically using LLM."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return [query]  # Return original if no API key
        
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.7)
        prompt = f"""
        Given this search query: "{query}"
        
        Generate 3-5 semantically related search queries that would help find relevant information.
        Return ONLY a JSON array of strings, no other text.
        
        Example: ["original query", "related query 1", "related query 2"]
        """
        
        response = llm.invoke(prompt)
        text = response.content.replace("```json", "").replace("```", "").strip()
        expanded = json.loads(text)
        return expanded if isinstance(expanded, list) else [query]
    except:
        return [query]

def semantic_search_with_expansion(query: str, n_results: int = 5):
    """Semantic search with query expansion."""
    expanded_queries = expand_query_semantically(query)
    all_results = []
    seen_content = set()
    
    for eq in expanded_queries:
        results = search_documents(eq, n_results=n_results)
        for r in results:
            content_hash = hash(r["content"][:100])  # Use first 100 chars as hash
            if content_hash not in seen_content:
                seen_content.add(content_hash)
                all_results.append(r)
    
    # Sort by score (lower is better for distance)
    all_results.sort(key=lambda x: x.get("score", 0))
    return all_results[:n_results]

def summarize_document(text: str, max_length: int = 200) -> str:
    """Automatically summarize a document."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return text[:max_length] + "..." if len(text) > max_length else text
        
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.3)
        prompt = f"""
        Summarize the following text in {max_length} characters or less. Focus on key points and main ideas.
        
        Text:
        {text[:2000]}  # Limit input to avoid token limits
        
        Summary:
        """
        
        response = llm.invoke(prompt)
        return response.content.strip()
    except:
        return text[:max_length] + "..." if len(text) > max_length else text

def get_knowledge_base_health() -> Dict:
    """Get knowledge base health metrics."""
    try:
        collection = get_collection()
        data = collection.get(include=['metadatas', 'documents'])
        
        total_chunks = len(data.get('documents', []))
        sources = set()
        source_chunk_counts = {}
        total_chars = 0
        
        for i, metadata in enumerate(data.get('metadatas', [])):
            if metadata and 'source' in metadata:
                source = metadata['source']
                sources.add(source)
                source_chunk_counts[source] = source_chunk_counts.get(source, 0) + 1
                if i < len(data.get('documents', [])):
                    total_chars += len(data['documents'][i])
        
        # Calculate coverage (simplified - based on number of sources)
        coverage_score = min(100, len(sources) * 10)  # 10 points per source, max 100
        
        # Calculate freshness (would need timestamps in metadata - simplified for now)
        freshness_score = 75  # Placeholder - would check last update times
        
        return {
            "total_documents": len(sources),
            "total_chunks": total_chunks,
            "total_characters": total_chars,
            "coverage_score": coverage_score,
            "freshness_score": freshness_score,
            "source_distribution": source_chunk_counts,
            "health_status": "good" if coverage_score > 50 else "needs_improvement"
        }
    except Exception as e:
        return {
            "error": str(e),
            "health_status": "error"
        }
