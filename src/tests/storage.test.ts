import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Define global localStorage for the test environment
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const DEFAULT_AGENTS = [{ id: 'default', name: 'Default Agent' }];

// The logic to test (moved from prototype_storage.ts)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveAgents(agents: any[]) {
    try {
        localStorage.setItem('agent_os_library', JSON.stringify(agents));
    } catch (e) {
        console.error("Failed to save agents to local storage", e);
    }
}

describe('Agent Storage Utility', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error during tests
        vi.spyOn(console, 'log').mockImplementation(() => {}); // Suppress console.log during tests
    });

    it('should initialize with default agents if no data in local storage', () => {
        const agents = initAgents();
        expect(agents).toEqual(DEFAULT_AGENTS);
    });

    it('should save and load agents correctly from local storage', () => {
        const newAgents = [{ id: 'new', name: 'New Agent' }];
        saveAgents(newAgents);
        const loadedAgents = initAgents();
        expect(loadedAgents).toEqual(newAgents);
    });

    it('should handle corrupt JSON data in local storage and return default agents', () => {
        localStorage.setItem('agent_os_library', '{invalid_json');
        const agents = initAgents();
        expect(agents).toEqual(DEFAULT_AGENTS);
        expect(console.error).toHaveBeenCalledWith("Failed to parse agents from local storage", expect.any(Error));
    });

    it('should handle valid JSON but non-array data in local storage and return default agents', () => {
        localStorage.setItem('agent_os_library', '{"some": "object"}');
        const agents = initAgents();
        expect(agents).toEqual(DEFAULT_AGENTS);
        expect(console.log).toHaveBeenCalledWith("Parsed data is not an array, falling back to default.");
    });

    it('should handle errors during save gracefully', () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => { throw new Error("QuotaExceeded"); });
        const newAgents = [{ id: 'new', name: 'New Agent' }];
        
        expect(() => saveAgents(newAgents)).not.toThrow();
        expect(console.error).toHaveBeenCalledWith("Failed to save agents to local storage", expect.any(Error));
        
        localStorage.setItem = originalSetItem; // Restore original
    });
});
