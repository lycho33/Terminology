import {
  useMutation,
  useQuery,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { getTerm, updateTerm, createTerm } from "./actions";
import type { Term } from "./terms/types";

export const useFetchTerm = (
  termName: string,
): QueryObserverResult<Term, unknown> => {
  return useQuery({
    queryKey: ["terms", termName],
    queryFn: () => getTerm(termName),
    staleTime: Infinity,
    enabled: termName.length > 0,
  });
};

export type UpdateTermInput = {
  term: string;
  newTerm: string;
};

export const useUpdateTerm = () => {
  return useMutation({
    mutationFn: (terms: UpdateTermInput) => updateTerm(terms),
  });
};

export const useCreateTerm = () => {
  return useMutation({
    mutationFn: (newTerm: string) => createTerm(newTerm),
  });
};
