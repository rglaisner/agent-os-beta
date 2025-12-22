# Agent OS - Fix Strategy & Execution Plan

## Overview
This document provides a detailed, step-by-step execution plan to fix all identified bugs and issues in the Agent OS application.

---

## 🔴 PHASE 1: CRITICAL BUG FIXES (Priority: IMMEDIATE)

### Fix #1: Mission History API Response Format

**Problem:** Backend returns `{"missions": missions}` but frontend expects array directly.

**Solution:** Update backend to return array directly and ensure proper serialization.

**Files to Modify:**
1. `backend/api/routes.py`
2. `backend/core/database.py` (optional - add serialization helper)

**Implementation:**

```python
# backend/api/routes.py - Line 166-172
@router.get("/missions")
async def list_missions():
    try:
        missions = get_missions()
        # Convert SQLAlchemy objects to dicts
        missions_dict = [
            {
                "id": m.id,
                "goal": m.goal,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "estimated_cost": float(m.estimated_cost) if m.estimated_cost else 0.0,
                "total_tokens": int(m.total_tokens) if m.total_tokens else 0
            }
            for m in missions
        ]
        return missions_dict  # Return array directly
    except Exception as e:
        raise HTTPException(500, str(e))
```

**Alternative (Better):** Create a Pydantic model for response:

```python
# backend/core/models.py - Add this
from datetime import datetime
from typing import Optional

class MissionResponse(BaseModel):
    id: int
    goal: str
    status: str
    created_at: Optional[str] = None
    estimated_cost: float = 0.0
    total_tokens: int = 0

# backend/api/routes.py
@router.get("/missions", response_model=List[MissionResponse])
async def list_missions():
    try:
        missions = get_missions()
        return [
            MissionResponse(
                id=m.id,
                goal=m.goal or "",
                status=m.status or "UNKNOWN",
                created_at=m.created_at.isoformat() if m.created_at else None,
                estimated_cost=float(m.estimated_cost or 0.0),
                total_tokens=int(m.total_tokens or 0)
            )
            for m in missions
        ]
    except Exception as e:
        raise HTTPException(500, str(e))
```

**Testing:**
- Verify `/api/missions` returns array
- Verify frontend displays missions correctly
- Test with empty database
- Test with multiple missions

---

### Fix #2: LiveMonitor Type Error

**Problem:** `l.content.includes()` called without type check.

**Solution:** Add type guard before string operations.

**Files to Modify:**
1. `src/components/LiveMonitor.tsx`

**Implementation:**

```typescript
// src/components/LiveMonitor.tsx - Line 25-32
// Extract images from logs
const images = logs
  .filter(l => typeof l.content === 'string' && l.content.includes('/static/plots/'))
  .map(l => {
      if (typeof l.content !== 'string') return null;
      const match = l.content.match(/\/static\/plots\/[a-zA-Z0-9_]+\.png/);
      return match ? match[0] : null;
  })
  .filter(Boolean) as string[];

// Also fix renderContent function - Line 60-79
const renderContent = (content: any) => {
  if (typeof content !== 'string') {
    // Handle non-string content (objects, arrays, etc.)
    try {
      return <pre className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">{JSON.stringify(content, null, 2)}</pre>;
    } catch {
      return <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">[Non-string content]</p>;
    }
  }

  // Check for image URL
  const imgMatch = content.match(/(\/static\/plots\/[a-zA-Z0-9_]+\.png)/);
  if (imgMatch) {
      const parts = content.split(imgMatch[0]);
      const httpBase = import.meta.env.VITE_BACKEND_URL 
        ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('/ws', '') 
        : 'http://localhost:8000';
      return (
          <div>
              {parts[0]}
              <div className="my-2 border border-slate-200 rounded overflow-hidden max-w-md shadow-sm">
                  <img src={`${httpBase}${imgMatch[0]}`} alt="Generated Chart" className="w-full" />
              </div>
              {parts[1]}
          </div>
      );
  }
  return <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">{content}</p>;
};
```

**Testing:**
- Test with string content
- Test with object content
- Test with null/undefined content
- Test with image URLs in content

---

### Fix #3: Mission History Error Handling

**Problem:** Silent failures when API returns unexpected format.

**Solution:** Add proper error handling and user feedback.

**Files to Modify:**
1. `src/components/MissionHistory.tsx`

**Implementation:**

```typescript
// src/components/MissionHistory.tsx - Update useEffect
useEffect(() => {
  const fetchMissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/missions`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      
      // Handle both array and object responses
      let missionsArray: Mission[] = [];
      if (Array.isArray(data)) {
        missionsArray = data;
      } else if (data && Array.isArray(data.missions)) {
        missionsArray = data.missions;
      } else {
        console.warn("Mission history data is not in expected format:", data);
        // Still set empty array, but log warning
      }
      
      setMissions(missionsArray);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setMissions([]);
      // Could add error state here to show user
    } finally {
      setLoading(false);
    }
  };
  
  fetchMissions();
}, [httpUrl]);
```

**Testing:**
- Test with valid array response
- Test with object response `{missions: [...]}`
- Test with invalid response
- Test with network error

---

## 🟡 PHASE 2: MEDIUM PRIORITY FIXES

### Fix #4: Plan Step ID Type Consistency

**Problem:** Mixed string/number types for PlanStep IDs.

**Solution:** Standardize on string IDs.

**Files to Modify:**
1. `src/constants.ts`
2. `src/components/MissionControl.tsx`

**Implementation:**

```typescript
// src/constants.ts - Line 28
export interface PlanStep {
  id: string; // Change from string | number to just string
  instruction: string;
  agentId: string;
  trainingIterations?: number;
}

// src/components/MissionControl.tsx - Line 113-119
const handleAddStep = (idx: number) => {
    const newStep: PlanStep = {
        id: `step-${Date.now()}`, // Ensure string ID
        agentId: agents[0]?.id || 'sys-manager',
        instruction: 'New task instruction...',
        trainingIterations: 0
    };
    const newPlan = [...plan];
    newPlan.splice(idx + 1, 0, newStep);
    setPlan(newPlan);
    setIsModified(true);
};
```

**Testing:**
- Verify plan steps have string IDs
- Test plan generation
- Test plan editing
- Test plan launch

---

### Fix #5: Human Input Request Type Handling

**Problem:** Inconsistent type handling for human input requests.

**Solution:** Ensure consistent type checking and data structure.

**Files to Modify:**
1. `src/components/LiveMonitor.tsx`
2. `src/App.tsx`

**Implementation:**

```typescript
// src/components/LiveMonitor.tsx - Line 42-50
useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog && (lastLog.type === 'INTERVENTION_REQUIRED' || lastLog.type === 'HUMAN_INPUT_REQUEST')) {
        // Validate that we have required data
        if (lastLog.requestId && lastLog.content) {
            // Only set if we don't already have an active intervention
            if (!activeIntervention) {
                setActiveIntervention(lastLog);
            }
        } else {
            console.warn('Human input request missing required fields:', lastLog);
        }
    }
}, [logs, activeIntervention]);
```

**Testing:**
- Test human input requests
- Test intervention modal display
- Test response handling

---

### Fix #6: Plan Validation Before Launch

**Problem:** No validation before launching mission.

**Solution:** Add validation for plan steps.

**Files to Modify:**
1. `src/components/MissionControl.tsx`

**Implementation:**

```typescript
// src/components/MissionControl.tsx - Add validation function
const validatePlan = (plan: PlanStep[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (plan.length === 0) {
    errors.push('Plan cannot be empty');
  }
  
  plan.forEach((step, idx) => {
    if (!step.instruction || step.instruction.trim().length === 0) {
      errors.push(`Step ${idx + 1} has no instruction`);
    }
    if (!step.agentId) {
      errors.push(`Step ${idx + 1} has no assigned agent`);
    }
    if (!agents.find(a => a.id === step.agentId)) {
      errors.push(`Step ${idx + 1} references non-existent agent`);
    }
  });
  
  return { valid: errors.length === 0, errors };
};

// Update Launch button handler
const handleLaunch = () => {
  const validation = validatePlan(plan);
  if (!validation.valid) {
    setError(`Cannot launch: ${validation.errors.join(', ')}`);
    return;
  }
  onLaunch(plan, uploadedFiles.map(f => f.path), processType);
};
```

**Testing:**
- Test with empty plan
- Test with invalid steps
- Test with missing agents
- Test with valid plan

---

### Fix #7: WebSocket Error Handling Improvements

**Problem:** Poor error messages and no retry logic.

**Solution:** Improve error handling and add retry mechanism.

**Files to Modify:**
1. `src/App.tsx`

**Implementation:**

```typescript
// src/App.tsx - Update connectWebSocket function
const connectWebSocket = (retries = 3): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(backendUrl);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "START_MISSION", payload: { agents, plan, files, processType } }));
        resolve(ws);
      };
      
      ws.onerror = (error) => {
        if (retries > 0) {
          // Retry with exponential backoff
          setTimeout(() => {
            connectWebSocket(retries - 1).then(resolve).catch(reject);
          }, Math.pow(2, 3 - retries) * 1000); // 1s, 2s, 4s
        } else {
          reject(new Error(`WebSocket connection error after ${retries} retries: ${error}`));
        }
      };
      
      // Set timeout for connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          if (retries > 0) {
            connectWebSocket(retries - 1).then(resolve).catch(reject);
          } else {
            reject(new Error('WebSocket connection timeout'));
          }
        }
      }, 10000);
    } catch (e) {
      reject(e);
    }
  });
};
```

**Testing:**
- Test with backend down
- Test with slow backend
- Test retry mechanism
- Test timeout handling

---

## 🟢 PHASE 3: CODE QUALITY IMPROVEMENTS

### Fix #8: Centralize Backend URL Configuration

**Problem:** Hardcoded URLs in multiple places.

**Solution:** Create configuration utility.

**Files to Create:**
1. `src/utils/config.ts`

**Implementation:**

```typescript
// src/utils/config.ts
export const getBackendUrl = (): string => {
  const wsUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';
  return wsUrl;
};

export const getHttpBackendUrl = (): string => {
  const wsUrl = getBackendUrl();
  return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace(/\/ws$/, '');
};
```

**Files to Update:**
- Replace all hardcoded URLs with utility functions

**Testing:**
- Test with default URL
- Test with custom VITE_BACKEND_URL
- Test with wss:// URLs

---

### Fix #9: Add Loading States

**Problem:** Missing loading indicators for async operations.

**Solution:** Add loading states to components.

**Files to Modify:**
1. `src/components/MissionHistory.tsx` (already has loading)
2. `src/components/KnowledgeBase.tsx` (already has loading)
3. Add to other components as needed

**Testing:**
- Verify loading states appear
- Verify loading states disappear
- Test with slow network

---

## 📋 TESTING CHECKLIST FOR FIXES

### Fix #1: Mission History API
- [ ] Backend returns array
- [ ] Frontend displays missions
- [ ] Empty state works
- [ ] Error handling works

### Fix #2: LiveMonitor Type Error
- [ ] String content works
- [ ] Object content doesn't crash
- [ ] Image extraction works
- [ ] Null/undefined handled

### Fix #3: Mission History Error Handling
- [ ] Array response works
- [ ] Object response works
- [ ] Error response handled
- [ ] Network error handled

### Fix #4: Plan Step ID Consistency
- [ ] All IDs are strings
- [ ] Plan generation works
- [ ] Plan editing works
- [ ] Plan launch works

### Fix #5: Human Input Handling
- [ ] Requests display correctly
- [ ] Modal shows correctly
- [ ] Responses work
- [ ] Missing data handled

### Fix #6: Plan Validation
- [ ] Empty plan rejected
- [ ] Invalid steps rejected
- [ ] Missing agents detected
- [ ] Valid plan launches

### Fix #7: WebSocket Error Handling
- [ ] Retry works
- [ ] Timeout handled
- [ ] Error messages clear
- [ ] Connection status shown

---

## 🚀 IMPLEMENTATION ORDER

1. **Day 1: Critical Fixes**
   - Fix #1: Mission History API
   - Fix #2: LiveMonitor Type Error
   - Fix #3: Mission History Error Handling

2. **Day 2: Medium Priority**
   - Fix #4: Plan Step ID Consistency
   - Fix #5: Human Input Handling
   - Fix #6: Plan Validation

3. **Day 3: Quality Improvements**
   - Fix #7: WebSocket Error Handling
   - Fix #8: Centralize Configuration
   - Fix #9: Loading States

4. **Day 4: Testing**
   - Run full test suite
   - Test all fixes
   - Verify no regressions

---

## 📝 NOTES

- All fixes should be tested individually before moving to next
- Use feature branches for each fix
- Write tests for critical fixes
- Update documentation as needed
- Consider backward compatibility

---

**Strategy Created:** $(date)
**Status:** Ready for Implementation
