import { createContext } from "react";
import type { UpdateTermInput } from "./hooks";
import type { CreateTermInput, Term } from "./terms/types";

export type CreateStatusEnum =
  | "active"
  | "inactive"
  | "pending"
  | "complete"
  | "error";

type MutationCallbacks = {
  onSuccess: () => void;
  onError?: () => void;
};

export type TermContextValue = {
  term: {
    name: string;
    setTerm: (name: string) => void;
    get: {
      term: Term | undefined;
      isError: boolean;
      isLoading: boolean;
      isSuccess: boolean;
      errorMessage: string | null;
      errorStatus: number | null;
    };
    create: {
      createTerm: (term: CreateTermInput, callbacks: MutationCallbacks) => void;
      status: CreateStatusEnum;
      setStatus: (status: CreateStatusEnum) => void;
      errorMessage: string | null;
      isPending: boolean;
      resetError: () => void;
    };
    update: {
      updateTerm: (
        input: UpdateTermInput,
        callbacks: MutationCallbacks,
      ) => void;
      isSuccess: boolean;
      resetUpdateSuccess: () => void;
      errorMessage: string | null;
      isPending: boolean;
    };
    remove: {
      deleteTerm: (term_id: string, success: { onSuccess: () => void }) => void;
      deleteErrorMessage: string | null;
      isDeletePending: boolean;
      resetDeleteError: () => void;
    };
  };
};
export const TermContext = createContext<TermContextValue | null>(null);
