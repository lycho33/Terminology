# Architecture

## Application architecture

```mermaid
flowchart LR
    user@{ icon: "mdi:account-circle", label: "User" }
    ui["React UI"]
    api["FastAPI"]
    db[("Neo4j Database")]

    user --> ui
    ui <--> api
    api <--> db
    api <--> model_router
    model_router <--> Qwen3-Coder-30B-A3B-Instruct-UD-IQ1_M
    model_router <--> open_model_2
```

The user creates, reads, updates, and deletes terms through the React UI. React sends those requests to FastAPI, which reads or writes term data in Neo4j and exchanges prompts and responses with a small open model.

## CRUD and persistence boundaries

| User action       | HTTP request                | Persistence path                           |
| ----------------- | --------------------------- | ------------------------------------------ |
| Search for a term | `GET /terms/{term_name}`    | Neo4j driver + Cypher `MATCH`                      |
| Create a term     | `POST /terms/`              | Neo4j driver + Cypher `CREATE`        |
| Edit a term       | `PATCH /terms/{term_name}`  | Neo4j driver + Cypher `MATCH`/`SET`   |
| Delete a term     | `DELETE /terms/{term_id}` | Neo4j driver + Cypher `DETACH DELETE` |
