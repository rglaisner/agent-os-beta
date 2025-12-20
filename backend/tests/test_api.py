import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.routes import router
from core.database import init_db, create_mission, update_mission_result

app = FastAPI()
app.include_router(router, prefix="/api")

class TestAPI(unittest.TestCase):
    def setUp(self):
        """Set up test client and initialize database"""
        init_db()
        self.client = TestClient(app)
        
    def test_list_missions_returns_array(self):
        """Test that /api/missions returns an array, not an object"""
        # Create a test mission
        mission_id = create_mission("Test Mission Goal")
        update_mission_result(mission_id, "Test result", tokens=100, cost=0.01)
        
        # Make request
        response = self.client.get("/api/missions")
        
        # Check status
        self.assertEqual(response.status_code, 200)
        
        # Check that response is an array (not an object with 'missions' key)
        data = response.json()
        self.assertIsInstance(data, list, "Response should be an array, not an object")
        self.assertGreater(len(data), 0, "Should have at least one mission")
        
        # Check structure of mission object
        mission = data[0]
        self.assertIn("id", mission)
        self.assertIn("goal", mission)
        self.assertIn("status", mission)
        self.assertIn("created_at", mission)
        self.assertIn("estimated_cost", mission)
        self.assertIn("total_tokens", mission)
        
    def test_list_missions_empty(self):
        """Test that /api/missions returns empty array when no missions"""
        response = self.client.get("/api/missions")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        
    def test_get_mission_details(self):
        """Test that /api/missions/{id} returns properly serialized mission"""
        # Create a test mission
        mission_id = create_mission("Test Mission Details")
        update_mission_result(mission_id, "Test result", tokens=200, cost=0.02, status="COMPLETED")
        
        # Make request
        response = self.client.get(f"/api/missions/{mission_id}")
        
        # Check status
        self.assertEqual(response.status_code, 200)
        
        # Check structure
        data = response.json()
        self.assertEqual(data["id"], mission_id)
        self.assertEqual(data["goal"], "Test Mission Details")
        self.assertEqual(data["status"], "COMPLETED")
        self.assertIsNotNone(data["created_at"])
        self.assertEqual(data["estimated_cost"], 0.02)
        self.assertEqual(data["total_tokens"], 200)

if __name__ == '__main__':
    unittest.main()
