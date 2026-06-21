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
    return term

@app.post("/terms/", status_code=status.HTTP_201_CREATED)
def create_term(payload: Term):
    gc = GraphConnection()

    create_query = """
    CREATE (t:Term {name: $name, definition: $definition, diagram: $diagram})
    RETURN t.name AS name, t.definition AS definition, t.diagram as diagram
    """

    result = gc.evaluate_query(
        create_query,
        {
            "name": payload.name.capitalize(),
            "definition": payload.definition if payload.definition else None,
            "diagram": payload.diagram if payload.diagram else None,
        },
    )

    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Fail to create Node {payload.name.capitalize()}",
        )

    return {"term": result}

@app.patch("/terms/{term_name}")
def update_term(term_name: str, payload: UpdateTermRequest):
    gc = GraphConnection()

    patch_query = """
    MATCH (t:Term {name: $current_name})
    SET
    t.name = CASE
        WHEN $updated_name IS NOT NULL THEN $updated_name
        ELSE t.name
    END,
    t.definition = CASE
        WHEN $updated_definition IS NOT NULL THEN $updated_definition
        ELSE t.definition
    END,
    t.diagram = CASE
        WHEN $updated_diagram IS NOT NULL THEN $updated_diagram
        ELSE t.diagram
    END
    RETURN t.name AS name, t.definition AS definition, t.diagram as diagram 
    """

    result = gc.evaluate_query(
        patch_query,
        {
            "current_name": term_name.capitalize(),
            "updated_name": payload.name.capitalize() if payload.name else None,
            "updated_definition": payload.definition,
            "updated_diagram": payload.diagram
        },
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Node {term_name.capitalize()} not found",
        )

    return {"term": result}

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