import { createContext } from "react";

export type CreateStatusEnum = "active" | "inactive" | "pending" | "complete";
export type TermContextValue = {
  term: string;
  setTerm: (term: string) => void;
  createStatus: CreateStatusEnum;
  setCreateStatus: (status: CreateStatusEnum) => void;
};
export const TermContext = createContext<TermContextValue | null>(null);
