import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { createTerm, deleteTerm, getTerm, updateTerm } from "./actions";
import { TermContext, type TermContextValue } from "./context";
import type { Term } from "./terms/types";
import { useContext } from "react";

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (terms: UpdateTermInput) => updateTerm(terms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] }); // Invalidate cache to refetch
    },
  });
};

export const useCreateTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTerm: string) => createTerm(newTerm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
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

// Created to deal with the null
export const useTermContext = (): TermContextValue => {
  const context = useContext(TermContext);

  if (!context) {
    throw new Error("useTermContext must be used inside TermProvider");
  }

  return context;
};
