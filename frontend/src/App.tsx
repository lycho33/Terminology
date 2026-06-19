import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import { TermProvider } from "./provider";
import { TermCard, TermSearchForm } from "./terms/Term";

const queryClient = new QueryClient();

// https://react.dev/learn/build-a-react-app-from-scratch#data-fetching
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TermProvider>
        <main id="center">
          <section className="term-workspace" aria-label="Terminology card">
            <div className="term-workspace__header">
              <p className="eyebrow">Terminology</p>
              <h1>Term Card</h1>
            </div>

            <TermSearchForm />
            <TermCard />
          </section>
        </main>
      </TermProvider>
    </QueryClientProvider>
  );
}
export default App;
