import os
import chromadb
from typing import List, Optional
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from crewai.tools import BaseTool

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
