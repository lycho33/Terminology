import type { UpdateTermInput } from "../hooks";

export type TermFormProps = {
  defaultTerm: string;
  onCreateClick: () => void;
  onSearch: (term: string) => void;
};
export type Term = {
  name: string;
  definition?: string;
};
export type TermCardProps = {
  term: Term;
  updateTerm: (termInputs: UpdateTermInput) => void;
  updateStatus: boolean;
  setTerm: (term: string) => void;
};
export type UpdateFormProps = {
  term: Term;
  onEditMode: (isEdit: boolean) => void;
  updateTerm: (termInputs: UpdateTermInput) => void;
  setTerm: (term: string) => void;
};

export type CreateFormProps = {
  createTerm: (newTerm: string) => void;
  onCreateComplete: () => void;
  setTerm: (term: string) => void;
};
