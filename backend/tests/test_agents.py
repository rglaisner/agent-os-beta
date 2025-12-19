import unittest
from unittest.mock import MagicMock, patch
from core.agents import create_agents, create_tasks, Agent, Task
from fastapi import WebSocket

class TestAgents(unittest.TestCase):
    def setUp(self):
        self.mock_websocket = MagicMock(spec=WebSocket)
        self.mock_mission_id = 123
        self.mock_uploaded_files = []
        self.agent_data = [
            {
                'id': 'agent_1',
                'role': 'Researcher',
                'goal': 'Research topics',
                'backstory': 'I am a researcher',
                'toolIds': ['tool-search'],
                'reasoning': True
            }
        ]

    @patch('core.agents.LLM')
    @patch('core.agents.Agent')
    def test_create_agents(self, MockAgent, MockLLM):
        agents = create_agents(self.agent_data, self.mock_uploaded_files, self.mock_websocket, self.mock_mission_id)

        # Verify agents created
        self.assertIn('agent_1', agents)
        self.assertIn('qc_agent', agents)

        # Verify QC Agent backstory contains the new instruction
        # We need to capture the args passed to Agent constructor for qc_agent
        # Since Agent is mocked, we check the calls

        # Filter calls for qc_agent
        qc_calls = [call for call in MockAgent.call_args_list if call.kwargs.get('role') == 'Quality Control Engineer']
        self.assertTrue(qc_calls)
        qc_backstory = qc_calls[0].kwargs.get('backstory')
        self.assertIn("correct file path and extension", qc_backstory)

    def test_create_tasks(self):
        mock_agent = MagicMock(spec=Agent)
        mock_agent.role = "Researcher"
        # Mock attributes accessed by Task validation in crewai
        mock_agent.goal = "Mock Goal"
        mock_agent.backstory = "Mock Backstory"
        mock_agent.verbose = False
        mock_agent.max_rpm = None
        mock_agent._token_process = MagicMock()
        mock_agent.security_config = None
        mock_agent.tools = []
        mock_agent.llm = MagicMock()
        mock_agent.llm.model = "gemini/gemini-2.0-flash"

        agents_map = {'agent_1': mock_agent}

        # Mock QC agent
        qc_agent = MagicMock(spec=Agent)
        qc_agent.role = "Quality Control Engineer"
        qc_agent.goal = "Quality Goal"
        qc_agent.backstory = "Quality Backstory"
        qc_agent.verbose = False
        qc_agent.max_rpm = None
        qc_agent._token_process = MagicMock()
        qc_agent.security_config = None
        qc_agent.tools = []
        qc_agent.llm = MagicMock()
        qc_agent.llm.model = "gemini/gemini-2.0-flash"

        agents_map['qc_agent'] = qc_agent

        plan = [{'agentId': 'agent_1', 'instruction': 'Do research'}]

        tasks = create_tasks(plan, agents_map, self.mock_uploaded_files)

        # Expect 3 tasks: Initial QC, Agent Task, Review QC
        self.assertEqual(len(tasks), 3)
        self.assertEqual(tasks[0].agent, qc_agent)
        self.assertEqual(tasks[1].agent, mock_agent)
        self.assertEqual(tasks[2].agent, qc_agent)

if __name__ == '__main__':
    unittest.main()
