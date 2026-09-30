from fastapi import FastAPI, HTTPException, status
# from typing import Optional
from neontology import init_neontology, Neo4jConfig, GraphConnection
from .config import settings
from .nodes import TermNode
from .models import ModelChatRequest, Term, UpdateTermRequest
from fastapi.middleware.cors import CORSMiddleware

import httpx
from neo4j.exceptions import ConstraintError, DriverError, Neo4jError

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
    # Initialize the connection to the database
    config = Neo4jConfig(
        uri=settings.neo4j_uri, 
        username=settings.neo4j_username, 
        password=settings.neo4j_password
    )
    init_neontology(config)

    gc = GraphConnection()

    unique_constraint_query = """
    CREATE CONSTRAINT term_name_unique IF NOT EXISTS
    FOR (t:Term) REQUIRE t.name IS UNIQUE
    """
    unique_result = gc.evaluate_query(unique_constraint_query)
    print(unique_result)

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

    try:
        result = gc.evaluate_query(
            create_query,
            {
                "name": payload.name.capitalize(),
                "definition": payload.definition if payload.definition else None,
                "diagram": payload.diagram if payload.diagram else None,
            },
        )
    except ConstraintError as exc:
        # Occurs from the create constraint for unique names
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"❌ {payload.name.capitalize()} already exists",
        ) from exc

    # TODO: 🔥
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"❌ Failed to create {payload.name.capitalize()}",
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

    try:
        result = gc.evaluate_query(
            patch_query,
            {
                "current_name": term_name.capitalize(),
                "updated_name": payload.name.capitalize() if payload.name else None,
                "updated_definition": payload.definition,
                "updated_diagram": payload.diagram
            },
        )
    except ConstraintError as exc:
        # Occurs from the create constraint for unique names
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.name.capitalize()} already exists. Rename the term as something else.",
        ) from exc

    # Would we still reach this error?
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
    try:
        res = gc.evaluate_query(delete_query, {"term_name": term_name.capitalize()})
    except (DriverError, Neo4jError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database failed to delete term {term_name.capitalize()}",
        ) from exc

    if res.records_raw[0]["deleted_count"] == 0:
        raise HTTPException(
            status_code=404,
            detail=f"Term {term_name.capitalize()} not found. Cannot delete",
        )

    return {"name": term_name, "result": res}

@app.get("/model/health", status_code=status.HTTP_200_OK)
async def model_health():
	model_url = "http://llama-cpp:9000/health"
	async with httpx.AsyncClient() as client:
			try:
				response = await client.get(model_url)
				
				# Raise an exception for 4xx or 5xx status codes
				response.raise_for_status() 
				
				return response.json()
				
			except httpx.HTTPStatusError as exc:
				raise HTTPException(
					status_code=exc.response.status_code, 
					detail=f"Model API error: {exc.response.text}"
				)
			except httpx.RequestError:
				raise HTTPException(
					status_code=503, 
					detail="Model API is unavailable"
				)

@app.post("/model/chat", status_code=status.HTTP_201_CREATED)
async def model_chat(payload: ModelChatRequest):
    model_url = "http://llama-cpp:9000/v1/chat/completions"

    # Non-streaming SVG generation can take several minutes on CPU.
    timeout = httpx.Timeout(30.0, connect=10.0, read=900.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                model_url,
                json={
                    "messages": [{"role": "user", "content": payload.prompt}],
                    "max_tokens": 8192,
                    "stream": False,
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Model API error: {exc.response.text}",
            ) from exc
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Model API timed out",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model API is unavailable",
            ) from exc
