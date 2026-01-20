"""
Application configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    database_url: str = "postgresql://findemo:findemo_dev_pass@localhost:5432/findemo_db"
    
    # JWT
    jwt_secret: str = "dev_secret_key_change_in_production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60
    
    # Application
    app_name: str = "Commodity Hedging & VaR Demo"
    debug: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
