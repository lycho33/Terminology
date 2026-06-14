import type { UpdateTermInput } from "./Data";
import type { Term } from "./terms/types";

type TermResponse = {
  term: Term;
};

// https://tanstack.com/query/latest/docs/framework/react/quick-start
export const getTerm = async (termName: string): Promise<Term> => {
  const response = await fetch(
    `http://localhost:8000/terms/${encodeURIComponent(termName)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json", // Set your desired content type
        Accept: "application/json", // Often paired with GET requests
      },
    },
  );

  if (!response.ok) {
    throw new Error("Network response was not ok for GET term");
  }

  const terms: TermResponse = await response.json();
  return terms.term;
};

export const updateTerm = async (
  termInputs: UpdateTermInput,
): Promise<Term> => {
  const response = await fetch(`http://localhost:8000/terms/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_name: termInputs.term,
      updated_name: termInputs.newTerm,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok for POST term");
  }

  const terms: TermResponse = await response.json();

  return terms.term;
};
