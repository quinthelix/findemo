# Port Configuration

## Development Ports

### Docker Frontend (Production-like)
```
http://localhost:3000
```
- Full-screen professional UI
- Dark sidebar with navigation
- Runs in Docker container
- Use this to test the deployed version

**Start:**
```bash
docker-compose up -d frontend
```

---

### Local npm Frontend (Development)
```
http://localhost:5173
```
- Same features as Docker
- Hot module replacement (HMR)
- Faster for development/testing
- Runs on your local machine

**Start:**
```bash
cd frontend
npm run dev
```

---

### Backend API
```
http://localhost:8000
```
- FastAPI backend
- Handles both frontend ports via CORS

**CORS Allowed Origins:**
- `http://localhost:3000` (Docker frontend)
- `http://localhost:5173` (Local npm frontend)

---

### Database
```
localhost:5432
```
- PostgreSQL
- Username: `findemo`
- Database: `findemo`

---

## Running Both Frontends Simultaneously

You can run both at the same time for comparison:

1. **Start Docker frontend:**
   ```bash
   docker-compose up -d
   ```
   Access at: http://localhost:3000

2. **Start local frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Access at: http://localhost:5173

3. **Login credentials (same for both):**
   - Username: `demo`
   - Password: `demo123`

---

## When to Use Which?

### Use Docker Frontend (port 3000) when:
- Testing the full production setup
- Verifying Docker configuration
- Testing CORS behavior
- Demonstrating to stakeholders

### Use Local npm Frontend (port 5173) when:
- Active development
- Making UI changes (faster HMR)
- Testing new features
- Debugging

---

## Port Summary

| Service | Port | URL | Notes |
|---------|------|-----|-------|
| Docker Frontend | 3000 | http://localhost:3000 | Production-like |
| Local Frontend | 5173 | http://localhost:5173 | Development |
| Backend API | 8000 | http://localhost:8000 | Shared by both |
| Database | 5432 | localhost:5432 | Shared by both |

---

## Troubleshooting

### Port Already in Use
```bash
# Check what's using a port
lsof -i :3000
lsof -i :5173
lsof -i :8000

# Kill a process
kill <PID>
```

### CORS Errors
Both ports are configured in backend CORS. If you get CORS errors:
```bash
# Restart backend
docker-compose restart backend
```

### Can't Access Frontend
```bash
# Check what's running
docker-compose ps
lsof -i :3000
lsof -i :5173

# Restart services
docker-compose restart frontend
cd frontend && npm run dev
```
