export type Term = {
  name: string;
  definition?: string;
};
export type UpdateFormProps = {
  onEditMode: (isEdit: boolean) => void;
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
