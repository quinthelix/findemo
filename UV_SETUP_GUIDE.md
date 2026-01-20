# UV Setup Guide for Findemo Backend

## What is uv?

`uv` is a **blazingly fast** Python package installer and resolver (10-100x faster than pip).

- Built in Rust
- Drop-in replacement for pip/pip-tools/virtualenv
- Manages virtual environments
- Resolves dependencies much faster

## Installation

### macOS/Linux

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Alternative (via pip)

```bash
pip install uv
```

### Verify Installation

```bash
uv --version
# Should show: uv 0.x.x
```

---

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend

# Create venv using uv (much faster than python -m venv)
uv venv

# Activate it
source .venv/bin/activate  # macOS/Linux
# or: .venv\Scripts\activate  # Windows
```

### 2. Install Dependencies

```bash
# Install app dependencies only
uv pip install -e .

# Install with test dependencies
uv pip install -e ".[test]"

# Install with dev tools (black, ruff, mypy)
uv pip install -e ".[dev]"

# Install everything (recommended for development)
uv pip install -e ".[test,dev]"
```

**Speed comparison**:
- `pip install`: ~45 seconds
- `uv pip install`: ~3 seconds ⚡

---

## Common Commands

### Sync Dependencies from pyproject.toml

```bash
# Install/update all dependencies
uv pip install -e ".[test,dev]"
```

### Add New Dependency

```bash
# Edit pyproject.toml manually, then:
uv pip install -e .

# Or use uv directly
uv pip install new-package
# Then add to pyproject.toml manually
```

### Run Commands in venv

```bash
# Without activating venv
uv run pytest tests/
uv run uvicorn app.main:app --reload
uv run black app/

# Or activate and run normally
source .venv/bin/activate
pytest tests/
uvicorn app.main:app --reload
```

### Update All Dependencies

```bash
uv pip install -e ".[test,dev]" --upgrade
```

---

## IDE Configuration

### VSCode

1. **Create venv**:
   ```bash
   cd backend && uv venv && uv pip install -e ".[test,dev]"
   ```

2. **Select interpreter**:
   - `Cmd+Shift+P` → "Python: Select Interpreter"
   - Choose: `./backend/.venv/bin/python`

3. **Settings** (`.vscode/settings.json`):
   ```json
   {
     "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python",
     "python.testing.pytestEnabled": true,
     "python.testing.pytestArgs": ["backend/tests"],
     "python.formatting.provider": "black",
     "python.linting.enabled": true,
     "python.linting.ruffEnabled": true
   }
   ```

### PyCharm

1. **Create venv**:
   ```bash
   cd backend && uv venv && uv pip install -e ".[test,dev]"
   ```

2. **Configure**:
   - Preferences → Project → Python Interpreter
   - Add → Existing environment
   - Select: `/path/to/findemo/backend/.venv/bin/python`

---

## Project Structure

### pyproject.toml Sections

```toml
[project]
dependencies = [...]              # Main app dependencies

[project.optional-dependencies]
test = [...]                      # pytest, test tools
dev = [...]                       # black, ruff, mypy

[tool.pytest.ini_options]         # pytest config
[tool.black]                      # black formatter config
[tool.ruff]                       # ruff linter config
[tool.mypy]                       # mypy type checker config
```

### Install Options

```bash
uv pip install -e .                # App only
uv pip install -e ".[test]"        # App + test tools
uv pip install -e ".[dev]"         # App + dev tools
uv pip install -e ".[test,dev]"    # Everything
```

---

## Development Workflow

### Local Development (with Docker DB)

```bash
# 1. Start database in Docker
docker-compose up -d postgres

# 2. Create/activate venv (one-time)
cd backend
uv venv
source .venv/bin/activate

# 3. Install dependencies (one-time)
uv pip install -e ".[test,dev]"

# 4. Run API locally
uvicorn app.main:app --reload

# API available at: http://localhost:8000
```

### Running Tests

```bash
# With uv (no activation needed)
uv run pytest tests/ -v

# Or traditional way
source .venv/bin/activate
pytest tests/ -v
```

### Code Quality

```bash
# Format code
uv run black app/ tests/

# Lint code
uv run ruff check app/ tests/

# Type check
uv run mypy app/

# Fix auto-fixable issues
uv run ruff check --fix app/ tests/
```

---

## Docker vs Local

### Docker (Production & Testing)

```bash
docker-compose up -d backend
docker-compose exec backend pytest tests/
```

**Pros**:
- ✅ Exact production environment
- ✅ No local setup needed
- ✅ Consistent across machines
- ✅ Now uses uv for fast builds! ⚡

**Note**: Docker build now uses `uv` internally for 10-100x faster image builds!

### Local with uv (Development)

```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[test,dev]"
uvicorn app.main:app --reload
```

**Pros**:
- ✅ Faster reload (no Docker layer)
- ✅ IDE autocomplete
- ✅ Direct debugging
- ✅ 10-100x faster dependency installs

---

## Troubleshooting

### Issue: `uv: command not found`

**Solution**: Install uv
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# Then restart terminal
```

### Issue: `ModuleNotFoundError` in IDE

**Solution**: Install with editable mode
```bash
cd backend
uv pip install -e ".[test,dev]"
# Then restart IDE or select interpreter
```

### Issue: Database connection refused

**Cause**: Using Docker hostname locally

**Solution**: Update `.env` for local development
```bash
# For local development (outside Docker)
DATABASE_URL=postgresql://findemo:findemo_dev_pass@localhost:5432/findemo_db

# For Docker (inside container)
DATABASE_URL=postgresql://findemo:findemo_dev_pass@postgres:5432/findemo_db
```

### Issue: Slow dependency resolution

**Solution**: That's what uv fixes! Use `uv pip install` instead of `pip install`

---

## Migration from requirements.txt

**Old way (pip)**:
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-test.txt
```

**New way (uv)**:
```bash
uv venv
source .venv/bin/activate
uv pip install -e ".[test,dev]"
```

**Benefits**:
- ⚡ 10-100x faster
- 📦 Single source of truth (pyproject.toml)
- 🎯 Optional dependency groups (test, dev)
- 🔧 Better for IDE integration

---

## Best Practices

### 1. Use uv for dependency management

```bash
# Install new package
uv pip install new-package
# Then add to pyproject.toml [project.dependencies]
```

### 2. Separate app, test, and dev dependencies

```toml
dependencies = [...]              # Production
[project.optional-dependencies]
test = [...]                      # Testing only
dev = [...]                       # Development only
```

### 3. Pin versions in pyproject.toml

```toml
"fastapi==0.109.0",  # Good - specific version
"pandas>=2.0",       # OK - minimum version
"requests",          # Avoid - unpinned
```

### 4. Keep Docker and local in sync

- Docker uses `pyproject.toml` (via `pip install -e .`)
- Local uses `pyproject.toml` (via `uv pip install -e .`)
- Both reference same source of truth

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `uv venv` | Create virtual environment |
| `uv pip install -e .` | Install app dependencies |
| `uv pip install -e ".[test]"` | Install with test deps |
| `uv pip install -e ".[dev]"` | Install with dev tools |
| `uv pip install -e ".[test,dev]"` | Install everything |
| `uv run pytest` | Run tests without activation |
| `uv run uvicorn app.main:app` | Run app without activation |
| `uv pip list` | List installed packages |
| `uv pip freeze` | Show pinned versions |

---

## Summary

**For Development** (Recommended):
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -e ".[test,dev]"
uvicorn app.main:app --reload
```

**For Testing**:
```bash
uv run pytest tests/ -v
```

**For Production**:
```bash
docker-compose up -d backend
```

**Why uv?**
- ⚡ 10-100x faster than pip
- 🎯 Better dependency resolution
- 📦 Modern Python tooling
- 🔧 Great for development

🚀 Happy coding!
