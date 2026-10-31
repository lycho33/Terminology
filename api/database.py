"""Shared driver access and compatibility for the existing scalar-query responses."""

from fastapi import Request
from neo4j import Driver


def get_driver(request: Request) -> Driver:
    return request.app.state.driver


def query_rows(
    driver: Driver, query: str, parameters: dict | None = None
) -> list[dict]:
    result = driver.execute_query(query, parameters_=parameters or {})
    return [record.data() for record in result.records]


def scalar_result(rows: list[dict]) -> dict:
    """Preserve the existing mutation JSON without retaining the old graph library.

    These endpoints return scalar columns only, so all graph collections are empty.
    Raw records were serialized as ordered value arrays by Pydantic.
    """
    return {
        "records_raw": [list(row.values()) for row in rows],
        "records": [{"nodes": {}, "relationships": {}, "paths": {}} for _ in rows],
        "nodes": [],
        "relationships": [],
        "paths": [],
        "node_link_data": {"nodes": [], "edges": [], "directed": True},
    }
