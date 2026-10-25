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
| Search for a term | `GET /terms/{term_name}`    | `TermNode.match(...)`                      |
| Create a term     | `POST /terms/`              | `GraphConnection` + Cypher `CREATE`        |
| Edit a term       | `PATCH /terms/{term_name}`  | `GraphConnection` + Cypher `MATCH`/`SET`   |
| Delete a term     | `DELETE /terms/{term_name}` | `GraphConnection` + Cypher `DETACH DELETE` |

## Where we're heading (working sketches)

These two diagrams are redrawn from whiteboard sketches. They describe
what we are *considering*, not what is built; the Mermaid diagram above is the
current state. Edit the `.svg` files directly and re-export the `.png` when they
change.

### Architecture vision

Local-first desktop app, a model router that fans out to local models and to
Claude via MCP, and a sandboxed Docker runner for diagram rendering.

![Architecture vision](assets/architecture-vision.svg)

### How a term becomes a diagram

The prompting pipeline: four prompt dimensions (term, classification,
abstraction level, visual format), model call, validation loop, render, and
attach back to the knowledge graph.

![How a term becomes a diagram](assets/learning-flow.svg)

PNG exports live next to the SVGs in `assets/` for Slack and slides.
