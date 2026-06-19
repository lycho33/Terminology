import type { UpdateTermInput } from "./hooks";
import type { Term } from "./terms/types";

type TermResponse = {
  term: Term;
};

// https://tanstack.com/query/latest/docs/framework/react/quick-start
export const getTerm = async (termName: string): Promise<Term> => {
  const response = await fetch(
    `http://localhost:8000/terms/${encodeURIComponent(termName)}`,
  );

  if (!response.ok) {
    throw new Error("Network response was not ok for GET term");
  }

  const terms: TermResponse = await response.json();
  return terms.term;
};

export const createTerm = async (termName: string): Promise<Term> => {
  const response = await fetch(`http://localhost:8000/terms/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: termName,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok for POST term");
  }

  const terms: TermResponse = await response.json(); // Update this

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
    throw new Error("Network response was not ok for PATCH term");
  }

  const terms: TermResponse = await response.json(); // Update this

  return terms.term;
};

type DeleteResponse = {
  name: string;
  result: unknown;
};
export const deleteTerm = async (termName: string): Promise<DeleteResponse> => {
  const response = await fetch(
    `http://localhost:8000/terms/${encodeURIComponent(termName)}`, // Adds space like "Docker%20registry" to make it URL friendly
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Network response was not ok for DELETE term");
  }

  return await response.json();
};
