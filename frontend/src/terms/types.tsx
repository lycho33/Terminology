import type { UpdateTermInput } from "../Data";

export type TermFormProps = {
  defaultTerm: string;
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
};
export type UpdateFormProps = {
  term: Term;
  onEditMode: (isEdit: boolean) => void;
  updateTerm: (termInputs: UpdateTermInput) => void;
};
