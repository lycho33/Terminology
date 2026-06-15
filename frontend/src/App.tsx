import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "./App.css";
import { TermSearchForm } from "./terms/Term";
import { Data } from "./Data";

const queryClient = new QueryClient();

// https://react.dev/learn/build-a-react-app-from-scratch#data-fetching
function App() {
  const [termName, setTermName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSearch = (term: string) => {
    setIsCreating(false);
    setTermName(term);
  };

  const handleCreateClick = () => {
    setIsCreating(!isCreating);
    setTermName("");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <main id="center">
        <section className="term-workspace" aria-label="Terminology card">
          <div className="term-workspace__header">
            <p className="eyebrow">Terminology</p>
            <h1>Term Card</h1>
          </div>

          <TermSearchForm
            onCreateClick={handleCreateClick}
            onSearch={handleSearch}
            defaultTerm={termName}
          />
          <Data
            isCreating={isCreating}
            onCreateComplete={() => setIsCreating(false)}
            termName={termName}
            setTerm={setTermName}
          />
        </section>
      </main>
    </QueryClientProvider>
  );
}
export default App;
