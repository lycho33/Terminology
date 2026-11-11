import { readApiError } from "./api-errors";
import type { UpdateTermInput } from "./hooks";
import type { Term } from "./terms/types";

type MutationResponse = {
  term: unknown;
};

export { isApiError } from "./api-errors";

// https://tanstack.com/query/latest/docs/framework/react/quick-start
export const getTerm = async (termName: string): Promise<Term> => {
  const response = await fetch(
    `http://localhost:8000/terms/${encodeURIComponent(termName)}`,
  );

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
  const response = await fetch(`http://localhost:8000/terms/`, {
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
    `http://localhost:8000/terms/${encodeURIComponent(termInputs.term)}`,
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
  const response = await fetch(
    `http://localhost:8000/terms/${encodeURIComponent(termId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw await readApiError(response, "Delete failed. Try again.");
  }

  return await response.json();
};
