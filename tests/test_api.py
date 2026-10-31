"""Stage-one API contracts. No server, credentials, or user database is used."""

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi.testclient import TestClient
from neo4j import Record
from neo4j.exceptions import ConstraintError, Neo4jError, ServiceUnavailable

from api.main import app, lifespan


def result(*rows):
    return SimpleNamespace(records=[Record(row) for row in rows])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.driver = MagicMock()
        self.driver.execute_query.return_value = result()
        self.settings_patch = patch(
            "api.main.Settings",
            return_value=SimpleNamespace(
                neo4j_uri="bolt://unused:7687",
                neo4j_username="test",
                neo4j_password="test",
            ),
        )
        self.driver_patch = patch(
            "api.main.GraphDatabase.driver", return_value=self.driver
        )
        self.settings_patch.start()
        self.driver_patch.start()
        self.addCleanup(self.settings_patch.stop)
        self.addCleanup(self.driver_patch.stop)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.driver.execute_query.reset_mock()

    def test_lookup_keeps_fields_and_parameterizes_name(self):
        term = dict(id="a1", name="A/b", definition=None, diagram="text")
        self.driver.execute_query.return_value = result(term)
        response = self.client.get("/terms/A%2FB")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), term)
        self.assertEqual(
            self.driver.execute_query.call_args.kwargs["parameters_"], {"name": "A/b"}
        )

    def test_missing_lookup_and_update(self):
        for method, kwargs in [("get", {}), ("patch", {"json": {"name": "new"}})]:
            with self.subTest(method=method):
                response = getattr(self.client, method)("/terms/missing", **kwargs)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json()["errors"][0]["code"], "TERM_NOT_FOUND")

    def test_create_preserves_scalar_response_and_generates_id(self):
        def create(query, parameters_):
            UUID(parameters_["id"])
            self.assertEqual(parameters_["name"], "Docker")
            self.assertEqual(len(parameters_["id"]), 32)
            self.assertNotIn("Docker", query)
            return result(parameters_)

        self.driver.execute_query.side_effect = create
        response = self.client.post(
            "/terms/", json={"name": "  DOCKER  ", "definition": "example"}
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["term"]
        self.assertEqual(data["records_raw"][0][1:], ["Docker", "example", None])
        self.assertEqual(
            data["records"], [{"nodes": {}, "relationships": {}, "paths": {}}]
        )
        self.assertEqual(
            data["node_link_data"], {"nodes": [], "edges": [], "directed": True}
        )

    def test_patch_keeps_null_noop_and_empty_text_values(self):
        self.driver.execute_query.return_value = result(
            dict(name="Old", definition="", diagram=None)
        )
        response = self.client.patch(
            "/terms/old", json={"definition": "", "name": None}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["term"]["records_raw"], [["Old", "", None]])
        self.assertEqual(
            self.driver.execute_query.call_args.kwargs["parameters_"],
            {
                "current_name": "Old",
                "updated_name": None,
                "updated_definition": "",
                "updated_diagram": None,
            },
        )

    def test_duplicate_create_and_rename_are_field_conflicts(self):
        self.driver.execute_query.side_effect = ConstraintError(
            "internal query details"
        )
        for method, path in [("post", "/terms/"), ("patch", "/terms/old")]:
            with self.subTest(method=method):
                response = getattr(self.client, method)(path, json={"name": "new"})
                self.assertEqual(response.status_code, 409)
                self.assertEqual(
                    response.json()["errors"][0],
                    {
                        "code": "TERM_ALREADY_EXISTS",
                        "field": "name",
                        "message": "A term with this name already exists.",
                    },
                )
                self.assertNotIn("internal query", response.text)

    def test_blank_name_is_rejected_before_query(self):
        for method, path in [("post", "/terms/"), ("patch", "/terms/old")]:
            for name in ["", "  \n\t"]:
                with self.subTest(method=method, name=name):
                    response = getattr(self.client, method)(path, json={"name": name})
                    self.assertEqual(response.status_code, 422)
                    self.assertEqual(
                        response.json()["errors"][0]["code"], "FIELD_BLANK"
                    )
                    self.assertEqual(response.json()["errors"][0]["field"], "name")
        self.driver.execute_query.assert_not_called()

    def test_missing_name_and_wrong_type(self):
        for payload, code in [
            ({}, "FIELD_REQUIRED"),
            ({"name": 123}, "INVALID_TYPE"),
            ({"name": None}, "INVALID_TYPE"),
        ]:
            response = self.client.post("/terms/", json=payload)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["errors"][0]["code"], code)
        self.driver.execute_query.assert_not_called()

    def test_multiple_fields_are_reported_without_raw_values(self):
        response = self.client.post(
            "/terms/", json={"name": " ", "definition": 12345, "diagram": {}}
        )
        errors = response.json()["errors"]
        self.assertEqual(
            [e["field"] for e in errors], ["name", "definition", "diagram"]
        )
        self.assertNotIn("12345", response.text)
        self.assertTrue(all(set(e) == {"code", "field", "message"} for e in errors))

    def test_malformed_json_is_form_error(self):
        response = self.client.post(
            "/terms/", content="{", headers={"Content-Type": "application/json"}
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["errors"][0]["code"], "INVALID_JSON")
        self.assertIsNone(response.json()["errors"][0]["field"])

    def test_delete_uses_id_and_preserves_count_response(self):
        self.driver.execute_query.return_value = result({"deleted_count": 1})
        response = self.client.delete("/terms/a1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["records_raw"], [[1]])
        self.assertEqual(
            self.driver.execute_query.call_args.kwargs["parameters_"], {"term_id": "a1"}
        )

    def test_delete_missing_term(self):
        self.driver.execute_query.return_value = result({"deleted_count": 0})
        self.assertEqual(self.client.delete("/terms/a1").status_code, 404)

    def test_database_errors_are_form_errors_for_all_operations(self):
        for exc, status, code in [
            (ServiceUnavailable("secret"), 503, "DATABASE_UNAVAILABLE"),
            (Neo4jError("secret"), 500, "DATABASE_ERROR"),
        ]:
            self.driver.execute_query.side_effect = exc
            for method, path, kwargs in [
                ("get", "/terms/a", {}),
                ("post", "/terms/", {"json": {"name": "a"}}),
                ("patch", "/terms/a", {"json": {"name": "a"}}),
                ("delete", "/terms/a", {}),
            ]:
                with self.subTest(code=code, method=method):
                    response = getattr(self.client, method)(path, **kwargs)
                    self.assertEqual(response.status_code, status)
                    self.assertEqual(response.json()["errors"][0]["code"], code)
                    self.assertIsNone(response.json()["errors"][0]["field"])
                    self.assertNotIn("secret", response.text)


class LifecycleTests(unittest.TestCase):
    def test_driver_closes_on_quit_and_failed_startup(self):
        for failure in [None, "connect", "constraint"]:
            with self.subTest(failure=failure):
                driver = MagicMock()
                if failure == "connect":
                    driver.verify_connectivity.side_effect = ServiceUnavailable("test")
                if failure == "constraint":
                    driver.execute_query.side_effect = Neo4jError("test")
                with (
                    patch(
                        "api.main.Settings",
                        return_value=SimpleNamespace(
                            neo4j_uri="bolt://unused",
                            neo4j_username="test",
                            neo4j_password="test",
                        ),
                    ),
                    patch("api.main.GraphDatabase.driver", return_value=driver),
                ):
                    if failure:

                        async def failed_start():
                            async with lifespan(app):
                                pass

                        with self.assertRaises((ServiceUnavailable, Neo4jError)):
                            asyncio.run(failed_start())
                    else:
                        with TestClient(app) as client:
                            self.assertEqual(client.get("/").status_code, 200)
                            self.assertIs(app.state.driver, driver)
                        self.assertIn(
                            "CREATE CONSTRAINT term_name_unique",
                            driver.execute_query.call_args.args[0],
                        )
                    driver.close.assert_called_once()
                    self.assertIsNone(app.state.driver)


if __name__ == "__main__":
    unittest.main()
