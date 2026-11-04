"""Operate only on the disposable database configured by the test runner."""
import json
import os
import sys
from neo4j import GraphDatabase

with GraphDatabase.driver(os.environ['NEO4J_URI'], auth=('', '')) as driver:
    operation = sys.argv[1]
    if operation == 'ready':
        driver.verify_connectivity()
        print(driver.get_server_info().agent)
    elif operation == 'link':
        values = json.load(sys.stdin)
        result = driver.execute_query(
            'MATCH (a:Term {id: $first}), (b:Term {id: $second}) CREATE (a)-[:E2E_LINK]->(b)',
            parameters_=values,
        )
        assert result.summary.counters.relationships_created == 1, 'Test relationship was not created'
    else:
        raise ValueError('Unsupported test database operation')
