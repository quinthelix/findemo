# Login Troubleshooting Guide

## Quick Check

### 1. Open Browser Console
1. Open http://localhost:5173
2. Press F12 or Right-click → Inspect
3. Go to **Console** tab
4. Try to login
5. Look for errors (red text)

Common errors:
- **CORS error** → Backend needs restart
- **Network error** → Backend not running
- **404 error** → API endpoint issue

---

## 2. Manual API Test

Test the backend directly:

```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'
```

**Expected response:**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer"
}
```

---

## 3. Check Services

### Backend Status
```bash
docker-compose ps
```

**Expected:**
```
findemo_backend    Up
findemo_postgres   Up
```

### Frontend Status
```bash
cd frontend
npm run dev
```

**Expected:**
```
Local: http://localhost:5173/
```

---

## 4. Quick Fixes

### If Backend Shows CORS Error
```bash
docker-compose restart backend
```

### If Frontend Not Loading
```bash
cd frontend
# Kill any existing processes
lsof -ti:5173 | xargs kill -9
# Restart
npm run dev
```

### If Still Not Working - Full Rebuild
```bash
# Stop all containers
docker-compose down

# Restart backend
docker-compose up -d

# Restart frontend
cd frontend
npm run dev
```

---

## 5. What Should Work

1. **Open:** http://localhost:5173
2. **See:** Full-screen login page with purple hero section
3. **Enter:** demo / demo123
4. **Click:** "Sign In" button
5. **Redirected to:** http://localhost:5173/dashboard/var
6. **See:** Dashboard with sidebar and VaR charts

---

## 6. Browser Console Commands

Open browser console and run:

```javascript
// Test API connection
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(d => console.log('Backend:', d))
  .catch(e => console.error('Backend Error:', e));

// Test login
fetch('http://localhost:8000/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'demo', password: 'demo123' })
})
  .then(r => r.json())
  .then(d => console.log('Login:', d))
  .catch(e => console.error('Login Error:', e));
```

---

## 7. Common Issues & Solutions

### Issue: "Cannot connect to backend"
**Solution:** Restart backend containers
```bash
docker-compose restart backend
```

### Issue: "Login button does nothing"
**Solution:** Check browser console for errors

### Issue: "Page is blank"
**Solution:** Restart frontend dev server
```bash
cd frontend
npm run dev
```

### Issue: "CORS policy error"
**Solution:** Backend CORS is configured for port 5173. Make sure:
- Frontend runs on port 5173
- Backend allows this origin (already configured)
- Restart backend if needed

---

## 8. Nuclear Option - Full Reset

If nothing works:

```bash
# 1. Stop everything
docker-compose down
cd frontend
lsof -ti:5173 | xargs kill -9

# 2. Clear caches
docker system prune -f
cd frontend
rm -rf node_modules/.vite

# 3. Restart backend
cd ..
docker-compose up -d

# Wait 10 seconds for backend to start
sleep 10

# 4. Restart frontend
cd frontend
npm run dev
```

Then try: http://localhost:5173

---

## 9. What to Report

If still not working, please share:

1. **Browser console errors** (screenshot or copy-paste)
2. **Backend logs:**
   ```bash
   docker-compose logs backend | tail -50
   ```
3. **Frontend terminal output**
4. **Which URL you're accessing**

---

**Most likely issue:** Browser cache. Try:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or open in Incognito/Private window
