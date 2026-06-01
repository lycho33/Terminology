import "./App.css";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <section id="center">
          <div className="hero">Hello</div>
          <Data />
        </section>
      </QueryClientProvider>
    </>
  );
}

const getTerm = async () => {
  const response = await fetch("http://localhost:8000/terms/container");
  const terms = await response.json(); // {"term":{"name":"Container"}}

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return terms.term.name;
};

function Data() {
  // TODO: Render it only once
  const { data } = useQuery({
    queryKey: ["terms"],
    queryFn: getTerm,
  });

  return (
    <>
      <div>Testing</div>
      <div>{data}</div>
    </>
  );
}

export default App;
