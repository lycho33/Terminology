import { useEffect, useRef, useState } from "react";
import { MdAdd, MdOutlineEdit } from "react-icons/md";
import { VscChromeClose } from "react-icons/vsc";
import { FiMinus } from "react-icons/fi";
import type {
  TermFormProps,
  UpdateFormProps,
  TermCardProps,
  CreateFormProps,
  DeleteModalProps,
} from "./types";

export const TermSearchForm = ({
  defaultTerm,
  onCreateClick,
  onSearch,
}: TermFormProps) => {
  const [term, setTerm] = useState(defaultTerm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerm(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = term.trim();

    if (nextTerm) {
      onSearch(nextTerm);
      setTerm("");
    }
  };

  return (
    <form className="term-search" onSubmit={handleSubmit}>
      <label htmlFor="term">Lookup term</label>
      <div className="term-search__controls">
        <input
          id="term"
          type="text"
          name="term"
          value={term}
          onChange={handleChange}
          placeholder="Term"
        />
        <button type="submit">Search</button>
        <button
          aria-label="Create term"
          className="term-search__create-button"
          type="button"
          onClick={onCreateClick}
        >
          <MdAdd aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};

export const CreateTermForm = ({
  createTerm,
  onCreateComplete,
  setTerm,
}: CreateFormProps) => {
  const [newTerm, setNewTerm] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTerm(e.target.value);
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();

    if (nextTerm) {
      createTerm(nextTerm);
      setTerm(nextTerm);
      onCreateComplete();
    }
  };

  return (
    <form className="term-card__update-form" onSubmit={handleSubmit}>
      <input
        className="term-card__update-input"
        id="term"
        type="text"
        name="term"
        value={newTerm}
        onChange={handleChange}
        placeholder="add term"
      />
      <button className="term-card__update-button" type="submit">
        Create
      </button>
    </form>
  );
};

const UpdateTermForm = ({
  term,
  onEditMode,
  updateTerm,
  setTerm,
}: UpdateFormProps) => {
  const [newTerm, setNewTerm] = useState<string>(term.name);
  const inputRef = useRef<HTMLInputElement>(null); // refers to the input field

  useEffect(() => {
    const input = inputRef.current; // input element

    if (!input) {
      return;
    }

    input.focus(); // put keyboard focus on the input element
    input.setSelectionRange(input.value.length, input.value.length); // moves the cursor only within the range of the term
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTerm(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();

    if (nextTerm) {
      updateTerm({ term: term.name, newTerm: nextTerm });
      setTerm(nextTerm);
    }
  };

  return (
    <form className="term-card__update-form" onSubmit={handleSubmit}>
      <input
        className="term-card__update-input"
        id="term"
        ref={inputRef}
        type="text"
        name="term"
        value={newTerm}
        onChange={handleChange}
        placeholder="update term"
      />
      <button className="term-card__update-button" type="submit">
        Update
      </button>
      <VscChromeClose onClick={() => onEditMode(false)} />
    </form>
  );
};

const DeleteModal = ({
  hasDeleteError,
  termName,
  handleConfirmDelete,
  handleCancelDelete,
  isDeleting,
}: DeleteModalProps) => {
  return (
    <div className="term-card__modal-backdrop">
      <div
        aria-describedby="delete-term-description"
        aria-labelledby="delete-term-title"
        aria-modal="true"
        className="term-card__delete-dialog"
        role="dialog"
      >
        <h3 id="delete-term-title">Delete term?</h3>
        <p id="delete-term-description">
          This will delete <strong>{termName}</strong> from your knowledge base.
        </p>
        {hasDeleteError && (
          <p className="term-card__delete-error" role="alert">
            Delete failed. Try again.
          </p>
        )}
        <div className="term-card__delete-actions">
          <button
            className="term-card__delete-cancel"
            type="button"
            onClick={handleCancelDelete}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="term-card__delete-confirm"
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TermCard = ({
  term,
  updateTerm,
  updateStatus,
  setTerm,
  deleteTerm,
  isDeleting,
  hasDeleteError,
}: TermCardProps) => {
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  return (
    <article className="term-card">
      <div className="term-card__topline">
        <span>Term</span>
        <span>Glossary</span>
      </div>
      <div className="term-card__title-row">
        {!isEdit || updateStatus ? (
          <>
            <h2>{term.name}</h2>
            <button
              aria-label={`Edit ${term.name}`}
              className="term-card__title-row-edit-btn"
              type="button"
              onClick={() => setIsEdit(true)}
            >
              <MdOutlineEdit aria-hidden="true" />
            </button>
            <button
              aria-label={`Delete ${term.name}`}
              className="term-card__icon-button term-card__delete-button"
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isDeleting}
            >
              <FiMinus aria-hidden="true" />
            </button>
          </>
        ) : (
          <UpdateTermForm
            term={term}
            onEditMode={setIsEdit}
            updateTerm={updateTerm}
            setTerm={setTerm}
          />
        )}
      </div>
      {isDeleteModalOpen && (
        <DeleteModal
          hasDeleteError={hasDeleteError}
          termName={term.name}
          handleConfirmDelete={() => deleteTerm(term.name)}
          handleCancelDelete={() => setIsDeleteModalOpen(false)}
          isDeleting={isDeleting}
        />
      )}
      <div className="term-card__section">
        <h3>Definition</h3>
        <p>{term.definition ?? "No definition saved yet."}</p>
      </div>
      <div className="term-card__meta" aria-label="Term details">
        <div>
          <span>Source</span>
          <strong>Terminology API</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>Active</strong>
        </div>
      </div>
    </article>
  );
};

export const TermCardSkeleton = () => {
  return (
    <div className="term-card term-card--loading" role="status">
      <span className="skeleton skeleton--short" />
      <span className="skeleton skeleton--title" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  );
};
