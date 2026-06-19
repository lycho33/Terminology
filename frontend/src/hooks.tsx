import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { getTerm, updateTerm, createTerm, deleteTerm } from "./actions";
import type { Term } from "./terms/types";

export const useFetchTerm = (
  termName: string,
): QueryObserverResult<Term, unknown> => {
  return useQuery({
    queryKey: ["terms", termName],
    queryFn: () => getTerm(termName),
    staleTime: 60 * 1000, // When to refresh to fresh data
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

export const useDeleteTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (term: string) => deleteTerm(term),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["terms"] }); // Removes this cached query
    },
  });
};
