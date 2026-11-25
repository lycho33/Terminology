import { readApiError } from "./api-errors";
import type { UpdateTermInput } from "./hooks";
import type { Term } from "./terms/types";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

type MutationResponse = {
  term: unknown;
};

export { isApiError } from "./api-errors";

export const searchTerms = async (
  partialTermName: string,
): Promise<Array<Term>> => {
  let response: Response;
  try {
    response = await fetch(
      `${API}/terms/?${new URLSearchParams({ q: partialTermName })}`,
    );
  } catch {
    throw new Error("Unable to reach the search service. Try again.");
  }

  if (!response.ok) {
    throw await readApiError(response, "Search failed. Try again.");
  }

  let terms: unknown;
  try {
    terms = await response.json();
  } catch {
    throw new Error(
      "The search service returned an invalid response. Try again.",
    );
  }
  if (
    !Array.isArray(terms) ||
    !terms.every(
      (term) =>
        typeof term === "object" &&
        term !== null &&
        typeof term.id === "string" &&
        typeof term.name === "string",
    )
  ) {
    throw new Error(
      "The search service returned an invalid response. Try again.",
    );
  }
  return terms;
};

// https://tanstack.com/query/latest/docs/framework/react/quick-start
export const getTerm = async (termName: string): Promise<Term> => {
  const response = await fetch(`${API}/terms/${encodeURIComponent(termName)}`);

  if (!response.ok) {
    throw await readApiError(response, "Term lookup failed. Try again.");
  }

  return await response.json();
};

export const createTerm = async (term: {
  name: string;
  definition?: string;
  diagram?: string;
}): Promise<MutationResponse> => {
  const response = await fetch(`${API}/terms/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: term.name,
      definition: term.definition,
      diagram: term.diagram,
    }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Create failed. Try again.");
  }

  return await response.json();
};

export const updateTerm = async (
  termInputs: UpdateTermInput,
): Promise<MutationResponse> => {
  const response = await fetch(
    `${API}/terms/${encodeURIComponent(termInputs.term)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: termInputs.newTerm,
        definition: termInputs.definition,
        diagram: termInputs.diagram,
      }),
    },
  );

  if (!response.ok) {
    throw await readApiError(response, "Update failed. Try again.");
  }

  return await response.json();
};

type DeleteResponse = {
  result: unknown;
};

export const deleteTerm = async (termId: string): Promise<DeleteResponse> => {
  const response = await fetch(`${API}/terms/${encodeURIComponent(termId)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw await readApiError(response, "Delete failed. Try again.");
  }

  return await response.json();
};
