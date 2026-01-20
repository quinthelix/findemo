# Findemo Backend API

FastAPI backend for Commodity Hedging & VaR Demo application.

## Quick Start with uv

### 1. Install uv (if not already installed)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv
```

### 2. Create and activate virtual environment

```bash
cd backend

# Create venv and install dependencies
uv venv
source .venv/bin/activate  # macOS/Linux
# or: .venv\Scripts\activate  # Windows

# Install app dependencies
uv pip install -e .

# Install with test dependencies
uv pip install -e ".[test]"

# Install with dev dependencies (linters, formatters)
uv pip install -e ".[dev]"

# Install everything
uv pip install -e ".[test,dev]"
```

### 3. Run locally (requires PostgreSQL running)

```bash
# Make sure database is running
docker-compose up -d postgres

# Run the API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Development

### Run Tests

```bash
# With uv
uv run pytest tests/ -v

# Or traditional
source .venv/bin/activate
pytest tests/ -v
```

### Format Code

```bash
# Black formatter
uv run black app/ tests/

# Ruff linter
uv run ruff check app/ tests/
```

### Type Checking

```bash
uv run mypy app/
```

## Docker (Production)

The application is designed to run in Docker:

```bash
docker-compose up -d backend
```

See main README for full Docker instructions.

## Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app
│   ├── config.py         # Settings
│   ├── database.py       # SQLAlchemy setup
│   ├── models/           # Pydantic & ORM models
│   ├── routers/          # API endpoints
│   ├── services/         # Business logic
│   └── utils/            # Helpers
├── tests/                # Test suite
├── db/                   # SQL scripts
├── pyproject.toml        # Dependencies & config
└── Dockerfile            # Docker image
```

## Environment Variables

Create `.env` file:

```bash
DATABASE_URL=postgresql://findemo:findemo_dev_pass@localhost:5432/findemo_db
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60
```

## Database Connection

### From Docker Container
```python
DATABASE_URL = "postgresql://findemo:findemo_dev_pass@postgres:5432/findemo_db"
```

### From Local venv
```python
DATABASE_URL = "postgresql://findemo:findemo_dev_pass@localhost:5432/findemo_db"
```

## Dependencies

All dependencies defined in `pyproject.toml`:

- **Main**: FastAPI, SQLAlchemy, Pandas, NumPy, yfinance
- **Test**: pytest, pytest-asyncio
- **Dev**: black, ruff, mypy, ipython

## API Documentation

When running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
