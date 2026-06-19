import { createContext } from "react";
import type { UpdateTermInput } from "./hooks";
import type { Term } from "./terms/types";

export type CreateStatusEnum = "active" | "inactive" | "pending" | "complete";
export type TermContextValue = {
  term: {
    name: string;
    setTerm: (name: string) => void;
    get: {
      term: Term | undefined;
      isError: boolean;
      isLoading: boolean;
      isSuccess: boolean;
    };
    update: {
      updateTerm: (input: UpdateTermInput) => void;
      isSuccess: boolean;
    };
    remove: {
      deleteTerm: (term: string, success: { onSuccess: () => void }) => void;
      isDeleteError: boolean;
      isDeletePending: boolean;
    };
  };
  create: {
    createTerm: (term: string) => void;
    status: CreateStatusEnum;
    setStatus: (status: CreateStatusEnum) => void;
  };
};
export const TermContext = createContext<TermContextValue | null>(null);
