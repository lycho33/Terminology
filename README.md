# Terminology

Build a personal knowledge graph with AI generated diagrams that help you visualize what you're learning.

### Demo So Far

- [Watch the demo video](https://github.com/lycho33/Terminology/raw/main/assets/terminology-demo.mp4)

### Tech Stack

- Neo4j
- FastApi
- Neontology
- Vite / React
- Llama.cpp

### Downloading and running the model in llama.cpp

```
cmake -S llama.cpp -B llama.cpp/build -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=ON
cmake --build llama.cpp/build --target llama-server -j 8

./llama.cpp/build/bin/llama-server \
  --model ./models/Qwen3-Coder-30B-A3B-Instruct-UD-IQ1_M.gguf \
  --ctx-size 8192 --parallel 1 --n-gpu-layers all \
  --host 127.0.0.1 --port 9001
```

[Architecture Diagram](ARCHITECTURE.md)

### Access DB

[Locally](http://localhost:7474/browser/)

### Running the containers

`docker compose up --build`

### Running an endpoint

http://0.0.0.0:8000

### API Docs (Swagger)

http://0.0.0.0:8000/docs
