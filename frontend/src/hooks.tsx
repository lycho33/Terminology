import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
} from "@tanstack/react-query";
import {
  createTerm,
  deleteTerm,
  getTerm,
  searchTerms,
  updateTerm,
} from "./actions";
import { TermContext, type TermContextValue } from "./context";
import type { Term } from "./terms/types";
import { useContext } from "react";

export const useFetchTerm = (
  termName: string,
): QueryObserverResult<Term, Error> => {
  return useQuery({
    queryKey: ["term", termName],
    queryFn: () => getTerm(termName),
    staleTime: 60 * 1000, // When to refresh to fresh data
    enabled: termName.length > 0,
  });
};

export const useSearchTerm = (
  partialTermName: string,
): QueryObserverResult<Array<Term>, Error> => {
  return useQuery({
    queryKey: ["terms", partialTermName],
    queryFn: () => searchTerms(partialTermName),
    staleTime: 60 * 1000, // When to refresh to fresh data
    enabled: partialTermName.length > 0,
    retry: false, // Show search errors immediately; the user can retry.
  });
};

export type UpdateTermInput = {
  term: string;
  newTerm: string;
  definition?: string;
  diagram?: string;
};

export const useUpdateTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (term: UpdateTermInput) => updateTerm(term),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      queryClient.invalidateQueries({ queryKey: ["term"] }); // Refresh saved details after editing.
    },
  });
};

export type CreateTermInput = {
  name: string;
  definition?: string;
  diagram?: string;
};
export const useCreateTerm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (term: CreateTermInput) => createTerm(term),
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
