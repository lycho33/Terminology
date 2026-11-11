"""Opt-in test against a DISPOSABLE Neo4j instance, never the user database.

Set NEO4J_TEST_URI to an isolated instance with authentication disabled.
The test creates the normal constraint and temporary terms with unique names.
"""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from neo4j import GraphDatabase

from api.main import app


@unittest.skipUnless(
    os.environ.get("NEO4J_TEST_URI"), "Requires a disposable Neo4j instance"
)
class Neo4jIntegrationTests(unittest.TestCase):
    def test_term_workflow_and_constraint(self):
        uri = os.environ["NEO4J_TEST_URI"]
        first = f"Stage-one-{uuid4().hex}/first"
        second = f"Stage-one-{uuid4().hex}-second"
        renamed = f"Stage-one-{uuid4().hex}/renamed"
        config = SimpleNamespace(neo4j_uri=uri, neo4j_username="", neo4j_password="")
        try:
            with (
                patch("api.main.Settings", return_value=config),
                TestClient(app) as client,
            ):
                self.assertEqual(
                    client.post("/terms/", json={"name": "   "}).status_code, 422
                )
                created = client.post(
                    "/terms/",
                    json={"name": first, "definition": "Before", "diagram": "A -> B"},
                )
                self.assertEqual(created.status_code, 201, created.text)
                original = client.get(f"/terms/{first}").json()
                self.assertEqual(original["name"], first.capitalize())
                self.assertEqual(
                    created.json()["term"]["records_raw"][0][0], original["id"]
                )
                self.assertEqual(
                    client.post("/terms/", json={"name": first}).status_code, 409
                )
                self.assertEqual(
                    client.post("/terms/", json={"name": second}).status_code, 201
                )
                conflict = client.patch(f"/terms/{first}", json={"name": second})
                self.assertEqual(conflict.status_code, 409, conflict.text)
                self.assertEqual(
                    conflict.json()["errors"][0]["code"], "TERM_ALREADY_EXISTS"
                )
                updated = client.patch(
                    f"/terms/{first}",
                    json={"name": renamed, "definition": "", "diagram": "B -> C"},
                )
                self.assertEqual(updated.status_code, 200, updated.text)
                self.assertEqual(client.get(f"/terms/{first}").status_code, 404)
                saved = client.get(f"/terms/{renamed}").json()
                self.assertEqual(
                    saved,
                    dict(
                        id=original["id"],
                        name=renamed.capitalize(),
                        definition="",
                        diagram="B -> C",
                    ),
                )
                self.assertEqual(
                    client.patch("/terms/missing", json={"name": "new"}).status_code,
                    404,
                )
                # Verify DETACH DELETE also works when the term has a relationship.
                app.state.driver.execute_query(
                    "MATCH (a:Term {name: $first}), (b:Term {name: $second}) CREATE (a)-[:TEST_LINK]->(b)",
                    first=renamed.capitalize(),
                    second=second.capitalize(),
                )
                deleted = client.delete(f"/terms/{original['id']}")
                self.assertEqual(deleted.status_code, 200, deleted.text)
                self.assertEqual(deleted.json()["result"]["records_raw"], [[1]])
                self.assertEqual(
                    client.delete(f"/terms/{original['id']}").status_code, 404
                )
                self.assertEqual(client.get(f"/terms/{renamed}").status_code, 404)
        finally:
            with GraphDatabase.driver(uri, auth=("", "")) as driver:
                driver.execute_query(
                    "MATCH (t:Term) WHERE t.name IN $names DETACH DELETE t",
                    names=[
                        first.capitalize(),
                        second.capitalize(),
                        renamed.capitalize(),
                    ],
                )
        self.assertIsNone(app.state.driver)
