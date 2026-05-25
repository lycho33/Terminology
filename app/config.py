from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    neo4j_uri: str 
    neo4j_username: str 
    neo4j_password: str 

    # Tell Pydantic to read from a .env file
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()