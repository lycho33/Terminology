import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "./App.css";
import { TermForm } from "./terms/Term";
import { Data } from "./Data";

const queryClient = new QueryClient();

// https://react.dev/learn/build-a-react-app-from-scratch#data-fetching
function App() {
  const [termName, setTermName] = useState("Docker");

  return (
    <QueryClientProvider client={queryClient}>
      <main id="center">
        <section className="term-workspace" aria-label="Terminology card">
          <div className="term-workspace__header">
            <p className="eyebrow">Terminology</p>
            <h1>Term Card</h1>
          </div>

          <TermForm onSearch={setTermName} defaultTerm={termName} />
          <Data termName={termName} />
        </section>
      </main>
    </QueryClientProvider>
  );
}
export default App;
