
// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; }
    };
})();

// Define global localStorage for the test
(global as any).localStorage = localStorageMock;

const DEFAULT_AGENTS = [{ id: 'default', name: 'Default Agent' }];

// The logic to test
function initAgents() {
    try {
        const saved = localStorage.getItem('agent_os_library');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            } else {
                console.log("Parsed data is not an array, falling back to default.");
            }
        }
    } catch (e) {
        console.error("Failed to parse agents from local storage", e);
    }
    return DEFAULT_AGENTS;
}

function saveAgents(agents: any[]) {
    try {
        localStorage.setItem('agent_os_library', JSON.stringify(agents));
    } catch (e) {
        console.error("Failed to save agents to local storage", e);
    }
}

// Tests
console.log("--- Test 1: Default initialization ---");
let agents = initAgents();
console.log("Agents:", JSON.stringify(agents));
if (JSON.stringify(agents) !== JSON.stringify(DEFAULT_AGENTS)) throw new Error("Test 1 Failed");

console.log("\n--- Test 2: Save and Load ---");
const newAgents = [{ id: 'new', name: 'New Agent' }];
saveAgents(newAgents);
agents = initAgents();
console.log("Agents from storage:", JSON.stringify(agents));
if (JSON.stringify(agents) !== JSON.stringify(newAgents)) throw new Error("Test 2 Failed");

console.log("\n--- Test 3: Corrupt Data (Invalid JSON) ---");
localStorage.setItem('agent_os_library', '{invalid_json');
agents = initAgents();
console.log("Agents after corrupt data:", JSON.stringify(agents)); // Should handle error and return default
if (JSON.stringify(agents) !== JSON.stringify(DEFAULT_AGENTS)) throw new Error("Test 3 Failed");

console.log("\n--- Test 4: Invalid Data (Valid JSON but not array) ---");
localStorage.setItem('agent_os_library', '{"some": "object"}');
agents = initAgents();
console.log("Agents after invalid data:", JSON.stringify(agents));
if (JSON.stringify(agents) !== JSON.stringify(DEFAULT_AGENTS)) throw new Error("Test 4 Failed");

console.log("\n--- Test 5: Save Error (Mock) ---");
// Mock setItem to throw
const originalSetItem = localStorage.setItem;
localStorage.setItem = () => { throw new Error("QuotaExceeded"); };
try {
    saveAgents(newAgents);
    console.log("Save handled error gracefully");
} catch (e) {
    console.error("Save threw error:", e);
    throw new Error("Test 5 Failed");
}
localStorage.setItem = originalSetItem;

console.log("\nAll tests passed!");
