from fastapi import FastAPI, HTTPException, status
from typing import Optional
from neontology import init_neontology, Neo4jConfig, GraphConnection
from .config import settings
from .nodes import TermNode
from .models import Term, UpdateTermRequest
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow [CORS](https://fastapi.tiangolo.com/tutorial/cors/#use-corsmiddleware)
origins = [
    "http://localhost:3030",
    "http://127.0.0.1:3030",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# -------------------------------------------------------------------------------
@app.get("/terms/{term_name}")
def get_term(term_name: str):
    term = TermNode.match(term_name.capitalize())
    if term is None:
        raise HTTPException(status_code=404, detail="😓 Term not found")
    return {"term": term}

@app.post("/terms/", status_code=status.HTTP_201_CREATED)
def create_term(term: Term): # Fix this????
    new_term = TermNode(name=term.name)
    new_term.create()
    return new_term

@app.patch("/terms/")
def update_term(request: UpdateTermRequest):
    gc = GraphConnection()

    patch_query = """
    MATCH (t:Term {name: $curr_term_name})
    SET t.name = $updated_term_name
    RETURN t.name
    """
    res = gc.evaluate_query(patch_query, {"curr_term_name": request.current_name, "updated_term_name": request.updated_name})
    return {"name": request.updated_name, "result": res}

@app.delete("/terms/{term_name}")
def delete_term(term_name: str):
    # TODO: Query injection security concerns
    # TODO: Validate that all other relationships are severed before deleting this

    gc = GraphConnection()

    delete_query = """
    MATCH (t:Term {name: $term_name})
    DETACH DELETE t
    RETURN count(t) as deleted_count
    """
    res = gc.evaluate_query(delete_query, {"term_name": term_name})
    return {"name": term_name, "result": res}