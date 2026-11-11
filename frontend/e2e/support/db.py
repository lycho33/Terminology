"""Operate only on the disposable database configured by the test runner."""
import json
import os
import sys
from neo4j import GraphDatabase

""" E2E Test helper that helps determine if the tests can send queries """
with GraphDatabase.driver(os.environ['NEO4J_URI'], auth=('', '')) as driver:
    operation = sys.argv[1]
    """Checks DB connection before starting tests"""
    if operation == 'ready':
        driver.verify_connectivity()
        print(driver.get_server_info().agent)

        """Checks there's a connection between 2 terms in the test before deleted a connected term"""
    elif operation == 'link':
        values = json.load(sys.stdin)
        result = driver.execute_query(
            'MATCH (a:Term {id: $first}), (b:Term {id: $second}) CREATE (a)-[:E2E_LINK]->(b)',
            parameters_=values,
        )
        assert result.summary.counters.relationships_created == 1, 'Test relationship was not created'
    else:
        raise ValueError('Unsupported test database operation')
