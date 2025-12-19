# Render.com Free Plan WebSocket Configuration Guide

## Important Free Plan Limitations

⚠️ **Critical Constraints:**
1. **5-minute connection limit**: WebSocket connections automatically drop after 5 minutes
2. **15-minute spin-down**: Services sleep after inactivity, causing 30-second cold starts
3. **Resource limits**: Limited RAM/CPU may affect performance

## What You CAN Do on Render (Free Plan)

### 1. ✅ Configure Environment Variables

In your Render dashboard, set these environment variables:

**Required:**
- `PORT` - Render automatically sets this (usually 10000), but ensure your code reads it
- `GEMINI_API_KEY` - Your API key
- `ENVIRONMENT` - Set to `production`

**Optional but Recommended:**
- `CORS_ORIGINS` - Set to your frontend URL (e.g., `https://your-frontend.onrender.com`) or `*` for development
- `PYTHON_VERSION` - Set to `3.10` or `3.11` if needed

### 2. ✅ Fix Port Binding

**Current Issue:** Your code hardcodes port 8000, but Render uses the `PORT` environment variable.

**Fix in `backend/main.py`:**
```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))  # Use Render's PORT or default to 8000
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### 3. ✅ Use Secure WebSocket (wss://)

**Critical:** Render requires `wss://` (secure WebSocket) for production, not `ws://`.

**Frontend Fix:** Ensure your `VITE_BACKEND_URL` uses `wss://`:
```
wss://your-backend.onrender.com/ws
```

**NOT:**
```
ws://your-backend.onrender.com:10000/ws  ❌ (Don't specify port!)
ws://your-backend.onrender.com/ws       ❌ (Not secure)
```

### 4. ✅ Remove Port from WebSocket URL

Render's proxy handles routing - **never specify a port** in WebSocket URLs.

**Correct:**
```typescript
const ws = new WebSocket('wss://your-backend.onrender.com/ws');
```

**Wrong:**
```typescript
const ws = new WebSocket('wss://your-backend.onrender.com:10000/ws'); // ❌
```

### 5. ✅ Check Render Service Settings

In your Render dashboard:

1. **Service Type**: Ensure it's set to "Web Service" (not Background Worker)
2. **Start Command**: Should be something like:
   ```bash
   cd backend && python main.py
   ```
   Or if using uvicorn directly:
   ```bash
   cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

3. **Health Check Path**: Set to `/api/missions` or create a simple `/health` endpoint

### 6. ✅ Implement Reconnection Logic

Due to the 5-minute limit, you MUST implement reconnection:

```typescript
// In your frontend WebSocket code
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connectWebSocket() {
  const ws = new WebSocket(backendUrl);
  
  ws.onclose = (event) => {
    if (event.code !== 1000) { // Not a normal closure
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(() => connectWebSocket(), delay);
      }
    }
  };
  
  ws.onopen = () => {
    reconnectAttempts = 0; // Reset on successful connection
  };
}
```

### 7. ✅ Add Health Check Endpoint

Create a simple health check for Render:

```python
# In backend/main.py
@app.get("/health")
async def health_check():
    return {"status": "ok", "port": os.getenv("PORT", "unknown")}
```

Set this as your health check path in Render dashboard.

## What You CANNOT Do (Free Plan Limitations)

❌ **Cannot disable the 5-minute WebSocket timeout**  
❌ **Cannot prevent service spin-down after 15 minutes**  
❌ **Cannot increase connection duration**  
❌ **Cannot configure custom WebSocket proxy settings**  
❌ **Cannot use WebSocket on Background Workers** (must be Web Service)

## Quick Fixes to Try Right Now

### Fix 1: Update main.py to use PORT env var

```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        ws="auto"  # Explicit WebSocket support
    )
```

### Fix 2: Update Frontend WebSocket URL

Ensure your frontend uses `wss://` and no port:

```typescript
// In src/App.tsx
const backendUrl = import.meta.env.VITE_BACKEND_URL || 
  (window.location.protocol === 'https:' 
    ? 'wss://your-backend.onrender.com/ws'
    : 'ws://localhost:8000/ws');
```

### Fix 3: Remove Duplicate WebSocket Endpoint

In `backend/main.py`, remove the root endpoint:

```python
# Keep only this:
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)

# Remove this (it might be causing conflicts):
# @app.websocket("/")
# async def websocket_endpoint_root(websocket: WebSocket):
#     await websocket_handler(websocket)
```

### Fix 4: Add WebSocket Origin Check

In `backend/api/websocket.py`, add origin validation:

```python
async def websocket_handler(websocket: WebSocket):
    # Check origin
    origin = websocket.headers.get("origin")
    allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
    
    if "*" not in allowed_origins and origin not in allowed_origins:
        await websocket.close(code=403, reason="Origin not allowed")
        return
    
    await websocket.accept()
    # ... rest of handler
```

## Testing Your Configuration

### 1. Check Render Logs

Look for these in your Render logs:
- ✅ `Application startup complete`
- ✅ `Uvicorn running on 0.0.0.0:10000`
- ❌ `403 Forbidden` (if you see this, origin/CORS issue)
- ❌ `Connection refused` (if you see this, port binding issue)

### 2. Test WebSocket Connection

Use browser console or `wscat`:

```bash
# Install wscat if needed
npm install -g wscat

# Test connection (replace with your URL)
wscat -c wss://your-backend.onrender.com/ws
```

### 3. Verify Environment Variables

In Render dashboard → Environment:
- `PORT` should be set automatically (don't set manually)
- `GEMINI_API_KEY` should be your key
- `ENVIRONMENT` should be `production`

## If 403 Persists After These Fixes

The 403 error on Render free plan is often caused by:

1. **Using `ws://` instead of `wss://`** (most common)
2. **Specifying port in WebSocket URL** (Render doesn't allow this)
3. **CORS origin mismatch** (check your frontend URL matches `CORS_ORIGINS`)
4. **Render proxy blocking WebSocket upgrade** (less common, but possible)

## Alternative: Use Render's Paid Plan

If WebSocket is critical and you need:
- ✅ No 5-minute timeout
- ✅ No spin-down
- ✅ Better performance
- ✅ More resources

Consider upgrading to Render's **Starter Plan** ($7/month) which removes these limitations.

## Next Steps

1. **Apply Fix 1-4 above** (port binding, wss://, remove duplicate endpoint, origin check)
2. **Redeploy on Render**
3. **Test WebSocket connection**
4. **If still failing**: Consider Strategy 2 (HTTP/SSE migration) from the main analysis document

---

**Note:** Even with all fixes, the 5-minute timeout on free plan means long-running missions will disconnect. You'll need reconnection logic or consider the HTTP/SSE approach for reliability.
