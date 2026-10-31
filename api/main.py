from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from neo4j import Driver, GraphDatabase
from neo4j.exceptions import ConstraintError, DriverError, Neo4jError
import httpx

from .config import Settings
from .database import get_driver, query_rows, scalar_result
from .errors import (
    ApiProblem,
    ErrorResponse,
    api_problem_handler,
    database_error_handler,
    validation_error_handler,
)
from .nodes import TermNode
from .models import ModelChatRequest, Term, UpdateTermRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
    )
    try:
        await run_in_threadpool(driver.verify_connectivity)
        await run_in_threadpool(
            driver.execute_query,
            "CREATE CONSTRAINT term_name_unique IF NOT EXISTS FOR (t:Term) REQUIRE t.name IS UNIQUE",
        )
        app.state.driver = driver
        yield
    finally:
        await run_in_threadpool(driver.close)
        app.state.driver = None


app = FastAPI(lifespan=lifespan, responses={422: {"model": ErrorResponse}})
app.add_exception_handler(ApiProblem, api_problem_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(DriverError, database_error_handler)
app.add_exception_handler(Neo4jError, database_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3030", "http://127.0.0.1:3030"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/terms/{term_name:path}")
def get_term(term_name: str, driver: Driver = Depends(get_driver)):
    rows = query_rows(
        driver,
        """
        MATCH (t:Term {name: $name})
        RETURN t.id AS id, t.name AS name, t.definition AS definition, t.diagram AS diagram
    """,
        {"name": term_name.capitalize()},
    )
    if not rows:
        raise ApiProblem(404, "TERM_NOT_FOUND", "Term not found.")
    return TermNode(**rows[0])


@app.post("/terms/", status_code=status.HTTP_201_CREATED)
def create_term(payload: Term, driver: Driver = Depends(get_driver)):
    term = TermNode(
        name=payload.name.capitalize(),
        definition=payload.definition,
        diagram=payload.diagram,
    )
    try:
        rows = query_rows(
            driver,
            """
            CREATE (t:Term {id: $id, name: $name, definition: $definition, diagram: $diagram})
            RETURN t.id AS id, t.name AS name, t.definition AS definition, t.diagram AS diagram
        """,
            term.model_dump(),
        )
    except ConstraintError as exc:
        raise ApiProblem(
            409, "TERM_ALREADY_EXISTS", "A term with this name already exists.", "name"
        ) from exc
    if not rows:
        raise ApiProblem(
            500, "DATABASE_ERROR", "The database did not return the created term."
        )
    return {"term": scalar_result(rows)}


@app.patch("/terms/{term_name:path}")
def update_term(
    term_name: str, payload: UpdateTermRequest, driver: Driver = Depends(get_driver)
):
    try:
        rows = query_rows(
            driver,
            """
            MATCH (t:Term {name: $current_name})
            SET t.name = CASE WHEN $updated_name IS NOT NULL THEN $updated_name ELSE t.name END,
                t.definition = CASE WHEN $updated_definition IS NOT NULL THEN $updated_definition ELSE t.definition END,
                t.diagram = CASE WHEN $updated_diagram IS NOT NULL THEN $updated_diagram ELSE t.diagram END
            RETURN t.name AS name, t.definition AS definition, t.diagram AS diagram
        """,
            {
                "current_name": term_name.capitalize(),
                "updated_name": payload.name.capitalize()
                if payload.name is not None
                else None,
                "updated_definition": payload.definition,
                "updated_diagram": payload.diagram,
            },
        )
    except ConstraintError as exc:
        raise ApiProblem(
            409, "TERM_ALREADY_EXISTS", "A term with this name already exists.", "name"
        ) from exc
    if not rows:
        raise ApiProblem(404, "TERM_NOT_FOUND", "Term not found.")
    return {"term": scalar_result(rows)}


@app.delete("/terms/{term_id}")
def delete_term(term_id: str, driver: Driver = Depends(get_driver)):
    rows = query_rows(
        driver,
        """
        MATCH (t:Term {id: $term_id})
        DETACH DELETE t
        RETURN count(t) AS deleted_count
    """,
        {"term_id": term_id},
    )
    if not rows or rows[0]["deleted_count"] == 0:
        raise ApiProblem(404, "TERM_NOT_FOUND", "Term not found. Cannot delete.")
    return {"result": scalar_result(rows)}


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
    model_url = "http://host.docker.internal:9001/v1/chat/completions" # making a request to llama.cpp that's running on my computer, not a container
    # model_url = "http://llama-cpp:9000/v1/chat/completions"
    # model_url = "http://model-runner.docker.internal/engines/llama.cpp/v1/chat/completions"

    timeout = httpx.Timeout(30.0, connect=10.0, read=900.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                model_url,
                json={
                    "messages": [{"role": "user", "content": payload.prompt}],
                    "model": "ai/gemma4",
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
