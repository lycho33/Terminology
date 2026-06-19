import type { UpdateTermInput } from "../hooks";

export type Term = {
  name: string;
  definition?: string;
};
export type UpdateFormProps = {
  term: Term;
  onEditMode: (isEdit: boolean) => void;
  setTerm: (term: string) => void;
  updateTerm: (input: UpdateTermInput) => void;
};

export type CreateFormProps = {
  createTerm: (newTerm: string) => void;
  setTerm: (term: string) => void;
};

export type DeleteModalProps = {
  hasDeleteError: boolean;
  termName: string;
  handleConfirmDelete: () => void;
  isDeleting: boolean;
  handleCancelDelete: () => void;
};
