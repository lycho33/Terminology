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

### Get the llama.cpp source

This repository includes llama.cpp as a Git submodule. It records a specific
commit so team members use the same source version:

```sh
git clone --recurse-submodules https://github.com/lycho33/Terminology.git
cd Terminology
```

For an existing clone, run these commands from the project root:

```sh
git pull
git submodule update --init --recursive
```

🚨 Do not use `--remote` during normal setup; it can select a different version.

When the team needs a newer version, one maintainer selects and tests a new
llama.cpp commit, then commits and pushes the updated submodule reference in
Terminology. Other team members run the existing-clone commands above and
rebuild the server.

Build files and model weights are not included. Each collaborator must build the
server and download a GGUF model separately.

#### Seeing what commit is currently used for llama.cpp

```
git ls-tree HEAD llama.cpp
```

### Build and run llama.cpp on macOS with Metal

Install CMake and the Xcode Command Line Tools first. Run the commands below from
the project root. For other platforms, use the [llama.cpp build instructions](llama.cpp/docs/build.md).

Download your GGUF model into `models/`. The example below expects
`Qwen3-Coder-30B-A3B-Instruct-UD-IQ1_M.gguf`; change the `--model` path if you use
a different file. The `models/` files are excluded from Git.

```sh
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
