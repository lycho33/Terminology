"""Plan contracts: source preservation and SVG-only writes before DB access."""

import json
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

from fastapi.testclient import TestClient
from neo4j import Record
from pydantic_core import PydanticCustomError
from api.main import app
from api.svg_diagram import validate_svg

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "tests/fixtures/svg-cases.json").read_text())
SVG = (ROOT / "docs/skill-graph/examples/connected-shapes.svg").read_text()


class SvgValidationTests(unittest.TestCase):
    def test_shared_format_changes_apply_without_restarting_the_validator(self):
        rules = json.loads((ROOT / "frontend/src/diagram/format.json").read_text())
        with TemporaryDirectory() as directory:
            path = Path(directory) / "format.json"
            path.write_text(json.dumps(rules))
            with patch("api.svg_diagram.FORMAT_PATH", path):
                self.assertEqual(validate_svg(SVG), SVG)
                # Match an editor's atomic save: replace the file, not its inode.
                replacement = Path(directory) / "replacement.json"
                replacement.write_text(json.dumps({**rules, "maxDepth": 1}))
                replacement.replace(path)
                with self.assertRaises(PydanticCustomError):
                    validate_svg(SVG)
                path.write_text(json.dumps(rules))
                self.assertEqual(validate_svg(SVG), SVG)

    def test_shared_format_cases(self):
        for case in CASES:
            with self.subTest(case=case["name"]):
                if case["valid"]:
                    self.assertEqual(validate_svg(case["source"]), case["source"])
                else:
                    with self.assertRaises(PydanticCustomError):
                        validate_svg(case["source"])

    def test_writes_reject_invalid_before_database_and_preserve_valid_source(self):
        driver = MagicMock()
        settings = SimpleNamespace(
            neo4j_uri="bolt://unused:7687", neo4j_username="test", neo4j_password="test"
        )
        with (
            patch("api.main.Settings", return_value=settings),
            patch("api.main.GraphDatabase.driver", return_value=driver),
            TestClient(app) as client,
        ):
            for method, url in [("post", "/terms/"), ("patch", "/terms/Example")]:
                for case in CASES:
                    with self.subTest(method=method, case=case["name"]):
                        driver.execute_query.reset_mock()
                        source = case["source"]
                        driver.execute_query.return_value = SimpleNamespace(
                            records=[
                                Record(
                                    {"id": "id", "name": "Example", "diagram": source}
                                )
                            ]
                        )
                        response = getattr(client, method)(
                            url, json={"name": "Example", "diagram": source}
                        )
                        if case["valid"]:
                            self.assertEqual(
                                response.status_code,
                                201 if method == "post" else 200,
                                response.text,
                            )
                            parameters = driver.execute_query.call_args.kwargs.get(
                                "parameters_", {}
                            )
                            self.assertEqual(
                                parameters[
                                    "diagram" if method == "post" else "updated_diagram"
                                ],
                                source,
                            )
                        else:
                            self.assertEqual(response.status_code, 422, response.text)
                            self.assertEqual(
                                response.json()["errors"][0]["code"], "INVALID_SVG"
                            )
                            self.assertEqual(
                                response.json()["errors"][0]["field"], "diagram"
                            )
                            driver.execute_query.assert_not_called()
