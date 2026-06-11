import "./App.css";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

const queryClient = new QueryClient();

// https://react.dev/learn/build-a-react-app-from-scratch#data-fetching
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

// https://tanstack.com/query/latest/docs/framework/react/quick-start
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
