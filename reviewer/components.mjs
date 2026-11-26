export const components = [
  { id: "editor", label: "Term editor", matches: /^(frontend\/src\/(?:App|terms\/|diagram\/)|frontend\/src\/.*\.css)/ },
  { id: "data", label: "Frontend data and cache", matches: /^frontend\/src\/(?:actions|hooks|context|provider|api-errors)/ },
  { id: "api", label: "FastAPI routes and validation", matches: /^api\/(?!nodes\.py|database\.py)/ },
  { id: "database", label: "Neo4j persistence", matches: /^api\/(?:nodes|database)\.py$/ },
  { id: "test", label: "Tests and runner", matches: /^(tests\/|frontend\/(?:tests\/|e2e\/|playwright\.config))/ },
  { id: "runtime", label: "Build and runtime", matches: /^(?:\.github\/|Dockerfile|docker-compose|requirements|frontend\/(?:package|vite\.config))/ },
  { id: "docs", label: "Documentation", matches: /^(?:docs\/|.*\.md$)/ },
];

export const mapRegions = [
  { id: "frontend", label: "Frontend", platform: "React · Vite", members: ["editor", "data"] },
  { id: "api", label: "API", platform: "FastAPI · Python", members: ["api"] },
  { id: "graph", label: "Knowledge graph", platform: "Neo4j", members: ["database"] },
];

export const connections = [
  { from: "editor", to: "data", label: "Edit term / read term" },
  { from: "data", to: "api", label: "HTTP requests" },
  { from: "api", to: "database", label: "Neo4j queries" },
  { from: "test", to: "editor", label: "Browser test" },
  { from: "runtime", to: "api", label: "API runtime" },
];

export function architecture(files) {
  const nodes = components.map(({ id, label }) => ({ id, label, files: [] }));
  const other = { id: "other", label: "Other changed files", files: [] };
  function add(path, revision) {
    const at = components.findIndex(({ matches }) => matches.test(path));
    (nodes[at] ?? other).files.push({ path, revision });
  }
  for (const file of files) {
    add(file.filename, file.status === "removed" ? "base" : "head");
    if (file.status === "renamed" && file.previous_filename) {
      const group = (path) => components.findIndex(({ matches }) => matches.test(path));
      if (group(file.filename) !== group(file.previous_filename)) {
        add(file.previous_filename, "base");
      }
    }
  }
  return { nodes: other.files.length ? [...nodes, other] : nodes, connections };
}
