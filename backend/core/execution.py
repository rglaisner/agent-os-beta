import asyncio
import json
from typing import List, Dict, Any, Optional
from fastapi import WebSocket

from crewai import Agent, Task, Crew, LLM
from core.config import MANAGER_MODEL, GEMINI_SAFETY_SETTINGS
from core.socket_handler import WebSocketHandler

# Data Models
class ExecutionContext:
    def __init__(self):
        self.history: List[str] = [] # Stores successful outputs

class SupervisorGrade:
    def __init__(self, score: int, threshold: int, status: str, feedback: str):
        self.score = score
        self.threshold = threshold
        self.status = status
        self.feedback = feedback

async def run_mission_loop(
    plan: List[dict],
    agents_map: Dict[str, Agent],
    websocket: WebSocket,
    mission_id: int
):
    context = ExecutionContext()

    # Initialize Supervisor LLM
    # We use a dedicated handler for the supervisor to track its usage if needed,
    # but strictly speaking we just need it to run.
    supervisor_llm = LLM(
        model=MANAGER_MODEL, # gemini-2.5-pro
        temperature=0.2, # Lower temp for grading consistency
        safety_settings=GEMINI_SAFETY_SETTINGS,
        timeout=600
    )

    await send_system_log(websocket, f"Starting Execution: Flow optimization enabled. Supervisor (Gemini 2.5 Pro) ready.")
    await send_system_log(websocket, "● ACTION")

    for step_index, step in enumerate(plan):
        agent_id = step.get('agentId')
        agent = agents_map.get(agent_id)
        if not agent:
            # Fallback
            agent = list(agents_map.values())[0]

        instruction = step.get('instruction', '')

        # Human-in-the-loop / Retry State
        attempts_allowed = 3
        current_attempt = 1
        step_complete = False

        while current_attempt <= attempts_allowed and not step_complete:
            # 1. Prepare Task
            # We inject context from previous steps
            context_str = "\n".join([f"Previous Output {i+1}:\n{out}" for i, out in enumerate(context.history)])
            full_description = f"{instruction}\n\nCONTEXT FROM PREVIOUS STEPS:\n{context_str}"

            # If retrying, add previous feedback?
            # (Ideally yes, but for now we rely on the agent doing it again.
            # We could append feedback to the description)

            await send_terminal_log(websocket, agent.role, f"Executing: {instruction} (Attempt {current_attempt}/{attempts_allowed})")

            # 2. Execute Agent
            # Create a mini-crew for this single step to leverage tools
            task = Task(
                description=full_description,
                expected_output="Detailed execution result.",
                agent=agent
            )

            # We assume a new crew per step to isolate context if needed,
            # but usually sharing memory is good.
            # However, for this specific manual loop, we want explicit control.
            crew = Crew(
                agents=[agent],
                tasks=[task],
                verbose=True # We capture logs via the global handlers setup in main.py
            )

            # Run in executor to not block async loop
            try:
                result_obj = await asyncio.get_event_loop().run_in_executor(None, crew.kickoff)
                result_content = str(result_obj)
            except Exception as e:
                result_content = f"Error during execution: {str(e)}"

            # 3. Supervisor Grading
            await send_terminal_log(websocket, "Supervisor", "Grading output...")

            grade = await evaluate_output(supervisor_llm, instruction, result_content, current_attempt, attempts_allowed)

            # Log Grade
            await send_terminal_log(websocket, "Supervisor", f"QS: {grade.score}%\nScore: {grade.score}/100 (Threshold: {grade.threshold}). {grade.status}")

            if grade.status == "Passed":
                await send_system_log(websocket, "● OUTPUT")
                # Show the accepted work
                await send_terminal_log(websocket, agent.role, result_content)

                context.history.append(result_content)
                await send_system_log(websocket, "● ACTION") # Prep for next
                step_complete = True
            else:
                # Failed
                if current_attempt < attempts_allowed:
                    await send_terminal_log(websocket, "Supervisor", f"Feedback: {grade.feedback}")
                    current_attempt += 1
                else:
                    # Hit limit - Human Intervention
                    user_decision = await request_human_intervention(
                        websocket,
                        agent.role,
                        instruction,
                        result_content,
                        grade
                    )

                    if user_decision['action'] == "PROCEED":
                        await send_terminal_log(websocket, "System", "User authorized proceeding with current output.")
                        context.history.append(result_content)
                        await send_system_log(websocket, "● OUTPUT")
                        await send_terminal_log(websocket, agent.role, result_content)
                        await send_system_log(websocket, "● ACTION")
                        step_complete = True
                    elif user_decision['action'] == "IGNORE":
                        await send_terminal_log(websocket, "System", "User chose to ignore this step.")
                        step_complete = True # Skip
                    elif user_decision['action'] == "RETRY":
                        await send_terminal_log(websocket, "System", "User granted 2 extra attempts.")
                        attempts_allowed += 2
                        current_attempt += 1
                    elif user_decision['action'] == "CANCEL":
                        await send_system_log(websocket, "Mission Cancelled by User.")
                        return # Exit loop
                    else:
                         # Default to proceed if something weird happens
                         step_complete = True

async def evaluate_output(llm: LLM, instruction: str, output: str, attempt: int, max_attempts: int) -> SupervisorGrade:
    # Determine base threshold
    if attempt == 1:
        base_threshold = 85
    elif attempt == 2:
        base_threshold = 75
    else:
        base_threshold = 60

    prompt = f"""
    You are a strict Quality Control Supervisor.
    Review the following work produced by an AI Agent.

    ORIGINAL INSTRUCTION:
    {instruction}

    AGENT OUTPUT:
    {output}

    Attempt: {attempt}
    Base Threshold: {base_threshold}%

    Task:
    1. Determine the complexity of the task (Simple, Moderate, Complex).
    2. Adjust the Threshold based on complexity (Simple: +5-10%, Complex: -5-15%). Max variation +/- 15%.
    3. Grade the output (0-100%).
       - If partial answer or missing chunks: heavy penalty.
       - If impossible knowledge (hallucination risk) avoided: lenient.
    4. Provide brief feedback.

    Return JSON ONLY:
    {{
        "complexity": "string",
        "threshold": int,
        "score": int,
        "status": "Passed" or "Failed",
        "feedback": "string"
    }}

    Condition for Pass: score >= threshold.
    """

    try:
        response = await asyncio.get_event_loop().run_in_executor(None, lambda: llm.call([{"role": "user", "content": prompt}]))
        # Clean response to ensure JSON
        content = response.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)
        return SupervisorGrade(
            score=data.get('score', 0),
            threshold=data.get('threshold', base_threshold),
            status=data.get('status', 'Failed'),
            feedback=data.get('feedback', 'No feedback provided.')
        )
    except Exception as e:
        print(f"Supervisor Error: {e}")
        # Fallback in case of LLM error
        return SupervisorGrade(score=0, threshold=base_threshold, status="Failed", feedback="Error during grading.")

async def request_human_intervention(websocket: WebSocket, agent_name: str, instruction: str, output: str, grade: SupervisorGrade) -> Dict:
    # Send request
    req_id = f"intervention_{int(asyncio.get_event_loop().time())}"
    await websocket.send_json({
        "type": "INTERVENTION_REQUIRED",
        "requestId": req_id,
        "content": {
            "agentName": agent_name,
            "instruction": instruction,
            "failedOutput": output,
            "score": grade.score,
            "threshold": grade.threshold,
            "feedback": grade.feedback
        }
    })

    # Wait for response
    # We need a way to wait for the specific response.
    # In `backend/main.py`, `human_input_store` is used. We can reuse it.
    from tools.base_tools import human_input_store

    while req_id not in human_input_store:
        await asyncio.sleep(1)

    response = human_input_store.pop(req_id)
    return response

# Logging Helpers
async def send_system_log(websocket: WebSocket, content: str):
    # Sends a log that appears as a raw line, maybe stylized
    await websocket.send_json({
        "type": "TERMINAL", # Using TERMINAL type for the black screen logs
        "content": content,
        "agentName": "System"
    })

async def send_terminal_log(websocket: WebSocket, agent: str, content: str):
    # Formatted log entry
    formatted = f"[{agent}]\n{content}"
    await websocket.send_json({
        "type": "TERMINAL",
        "content": formatted,
        "agentName": agent
    })
