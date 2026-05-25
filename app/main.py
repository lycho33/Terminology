from fastapi import FastAPI
from neontology import BaseNode, BaseRelationship, init_neontology, Neo4jConfig
from pathlib import Path
from .config import settings

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    # Initialise the connection to the database
    config = Neo4jConfig(
        uri=settings.neo4j_uri, 
        username=settings.neo4j_username, 
        password=settings.neo4j_password
    )
    init_neontology(config)

@app.get("/")
def read_root():
    return {"Hello": "World"}