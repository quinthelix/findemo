"""
Pytest configuration and shared fixtures
"""
import pytest
import asyncio
import os

# Set test environment variables
os.environ["DATABASE_URL"] = "postgresql://findemo:findemo_dev_pass@postgres:5432/findemo_db"
os.environ["JWT_SECRET"] = "test_secret_key"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_EXPIRATION_MINUTES"] = "60"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
