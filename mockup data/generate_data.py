import json
import csv
import random
import pandas as pd

# --- CONFIGURATION ---
COMPANY_NAME = "Vertex Dynamics"
ROLES = ["Senior Backend Engineer", "Frontend Developer", "Database Administrator", "QA Engineer", "Product Manager"]
SKILLS_LEGACY = ["Java", "Spring Boot", "Oracle SQL", "Jenkins", "SOAP APIs", "Jira"]
SKILLS_MODERN = ["Python", "PyTorch", "LangChain", "React", "Docker", "FastAPI"]

# --- 1. GENERATE SKILL TAXONOMY (The Map) ---
# Maps skills to "Strategic Value" (1-10) and Training Costs
taxonomy_data = [
    {"Skill": "Java", "Category": "Backend", "Strategic_Value": 4, "Training_Cost_Per_Hour": 50},
    {"Skill": "Spring Boot", "Category": "Backend", "Strategic_Value": 5, "Training_Cost_Per_Hour": 50},
    {"Skill": "Oracle SQL", "Category": "Database", "Strategic_Value": 3, "Training_Cost_Per_Hour": 40},
    {"Skill": "Python", "Category": "AI/ML", "Strategic_Value": 10, "Training_Cost_Per_Hour": 150},
    {"Skill": "PyTorch", "Category": "AI/ML", "Strategic_Value": 10, "Training_Cost_Per_Hour": 200},
    {"Skill": "LangChain", "Category": "AI/ML", "Strategic_Value": 9, "Training_Cost_Per_Hour": 180},
    {"Skill": "React", "Category": "Frontend", "Strategic_Value": 6, "Training_Cost_Per_Hour": 80},
    {"Skill": "Strategic Thinking", "Category": "Leadership", "Strategic_Value": 8, "Training_Cost_Per_Hour": 120}
]
pd.DataFrame(taxonomy_data).to_csv("skill_taxonomy.csv", index=False)

# --- 2. GENERATE STRATEGIC INTENT (The Goal) ---
strategic_intent = """
STRATEGIC INTENT MEMO
FROM: CEO, Vertex Dynamics
TO: Engineering & Product Leadership
DATE: 2025-01-15
SUBJECT: Strategic Pivot to AI-First Customer Support (Project: "NeuralSupport")

Objective:
By Q3 2025, Vertex Dynamics must launch "NeuralSupport," a Generative AI module capable of automating 40% of our client's tier-1 support tickets.

Key Requirements:
1. Transition our core legacy Java monolith to microservices that can interface with LLMs.
2. Build a RAG (Retrieval-Augmented Generation) pipeline using Python and LangChain.
3. Ensure all engineers have functional literacy in AI capability (Prompt Engineering, Basic Python).

Constraint:
Hiring freeze is in effect. We must achieve this via internal mobility and upskilling.
Target ROI: Upskilling cost must not exceed 20% of external hiring cost.
"""
with open("strategic_intent.txt", "w") as f:
    f.write(strategic_intent)

# --- 3. GENERATE EMPLOYEES (The Workforce) ---
# Scenario: 50 staff. Heavy on Java (Legacy), Light on Python (Modern).
employees = []
for i in range(1, 51):
    role = random.choice(ROLES)
    # High chance of Legacy Skills
    skills = {}
    for skill in SKILLS_LEGACY:
        if random.random() > 0.3: 
            skills[skill] = random.randint(3, 5) # Proficiency 3-5
            
    # Low chance of Modern Skills (The Gap)
    for skill in SKILLS_MODERN:
        if random.random() > 0.8: # Only 20% know Python
            skills[skill] = random.randint(1, 2) # Low proficiency
        else:
            skills[skill] = 0 # Missing skill

    salary = random.randint(90000, 160000)
    
    emp = {
        "id": f"EMP_{i:03d}",
        "name": f"Engineer_{i}",
        "role": role,
        "salary": salary,
        "hourly_rate": round(salary / 2080, 2),
        "skills": skills
    }
    employees.append(emp)

with open("employees.json", "w") as f:
    json.dump(employees, f, indent=4)

print("✅ Data Generated: skill_taxonomy.csv, strategic_intent.txt, employees.json")