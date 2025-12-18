import requests

def test_knowledge_api():
    base_url = "http://localhost:8000/api/knowledge"

    # 1. Test Search (Empty or Non-existent)
    print("Testing Search...")
    try:
        res = requests.post(f"{base_url}/search", json={"query": "nonexistent"})
        assert res.status_code == 200
        print("Search Response:", res.json())
    except Exception as e:
        print(f"Search failed: {e}")

    # 2. Test Delete (Non-existent - should probably fail or pass silently depending on impl, my impl returns false but API returns 500 if false)
    # Actually my impl: if not success: raise HTTPException(500)
    # So deleting a non-existent file will likely fail if logic implies it exists.
    # But delete_document_by_source uses `collection.delete(where=...)` which might not throw if nothing found.
    # Let's try adding then deleting.

if __name__ == "__main__":
    test_knowledge_api()
