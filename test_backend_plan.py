import requests
import json
import time
import sys

def test_plan_generation():
    url = "http://127.0.0.1:8000/api/plan"
    payload = {
        "goal": "Test Goal",
        "agents": [
            {
                "id": "test-agent",
                "role": "Tester",
                "goal": "Test things",
                "backstory": "I test things",
                "toolIds": [],
                "humanInput": False
            }
        ],
        "process_type": "sequential"
    }

    print(f"Sending POST to {url}")
    for i in range(5):
        try:
            response = requests.post(url, json=payload, timeout=5)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            if response.status_code == 200:
                print("Plan generation successful!")
                return
            else:
                print("Plan generation failed!")
                return
        except Exception as e:
            print(f"Attempt {i+1} failed: {e}")
            time.sleep(2)

    print("All attempts failed.")
    sys.exit(1)

if __name__ == "__main__":
    test_plan_generation()
