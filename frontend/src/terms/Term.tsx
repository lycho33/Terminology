import { useEffect, useRef, useState } from "react";
import { FiMinus } from "react-icons/fi";
import { MdAdd, MdOutlineEdit } from "react-icons/md";
import { VscChromeClose } from "react-icons/vsc";
import { useTermContext } from "../hooks";
import type { DeleteModalProps, UpdateFormProps } from "./types";

export const TermSearchForm = () => {
  const { term, create } = useTermContext();
  const { name, setTerm } = term;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = name.trim();

    if (nextTerm) {
      create.setStatus("inactive");
      setTerm("");
    }
  };

  const handleSubmitClick = () => {
    create.setStatus("active");
    setTerm("");
  };

  return (
    <form className="term-search" onSubmit={handleSearchSubmit}>
      <label htmlFor="term">Lookup term</label>
      <div className="term-search__controls">
        <input
          id="term"
          type="text"
          name="term"
          value={name}
          onChange={handleChange}
          placeholder="Term"
        />
        <button type="submit">Search</button>
        <button
          aria-label="Create term"
          className="term-search__create-button"
          type="button"
          onClick={handleSubmitClick}
        >
          <MdAdd aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};

export const CreateTermForm = () => {
  const { term, create } = useTermContext();
  const { setTerm } = term;

  const [newTerm, setNewTerm] = useState<string>("");
  const [newDefinition, setNewDefinition] = useState<string>("");

  const handleTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTerm(e.target.value);
  };

  const handleDefinitionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setNewDefinition(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();
    const nextDefinition = newDefinition.trim();

    if (nextTerm) {
      create.setStatus("pending");
      create.createTerm({
        name: nextTerm,
        definition: nextDefinition || undefined,
      });
      setTerm(nextTerm);
      create.setStatus("complete");
    }
  };

  return (
    <form className="term-card__create-form" onSubmit={handleSubmit}>
      <div className="term-card__create-fields">
        <input
          className="term-card__update-input"
          id="create-term"
          type="text"
          name="term"
          value={newTerm}
          onChange={handleTermChange}
          placeholder="add term"
        />
        <div className="term-card__definition-editor">
          <label className="term-card__definition-label" htmlFor="definition">
            Definition
          </label>
          <textarea
            className="term-card__definition-input"
            id="definition"
            name="definition"
            value={newDefinition}
            onChange={handleDefinitionChange}
            placeholder="No definition saved yet."
            rows={3}
          />
        </div>
      </div>
      <div className="term-card__create-actions">
        <button className="term-card__update-button" type="submit">
          Create
        </button>
      </div>
    </form>
  );
};

const UpdateTermForm = ({ onEditMode }: UpdateFormProps) => {
  const { term } = useTermContext();
  const { name, get, setTerm, update } = term;

  const [newTerm, setNewTerm] = useState<string>(name);
  const [newDefinition, setNewDefinition] = useState<string>(
    get.term?.definition ?? "",
  );
  const inputRef = useRef<HTMLInputElement>(null); // refers to the input field

  useEffect(() => {
    const input = inputRef.current; // input element

    if (!input) {
      return;
    }

    input.focus(); // put keyboard focus on the input element
    input.setSelectionRange(input.value.length, input.value.length); // moves the cursor only within the range of the term
  }, []);

  const handleTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTerm(e.target.value);
  };

  const handleDefinitionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setNewDefinition(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();
    const nextDefinition = newDefinition.trim();

    if (nextTerm) {
      update.updateTerm({
        term: name,
        newTerm: nextTerm,
        definition: nextDefinition || undefined,
      });
      setTerm(nextTerm);
    }
  };

  return (
    <form className="term-card__edit-form" onSubmit={handleSubmit}>
      <div className="term-card__edit-title-row">
        <input
          className="term-card__update-input"
          id="term"
          ref={inputRef}
          type="text"
          name="term"
          value={newTerm}
          onChange={handleTermChange}
          placeholder="update term"
        />
        <button className="term-card__update-button" type="submit">
          Update
        </button>
        <button
          aria-label="Cancel update"
          className="term-card__icon-button"
          type="button"
          onClick={() => onEditMode(false)}
        >
          <VscChromeClose aria-hidden="true" />
        </button>
      </div>
      <div className="term-card__definition-editor">
        <label className="term-card__definition-label" htmlFor="definition">
          Definition
        </label>
        <textarea
          className="term-card__definition-input"
          id="definition"
          name="definition"
          value={newDefinition}
          onChange={handleDefinitionChange}
          placeholder="No definition saved yet."
          rows={3}
        />
      </div>
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

export const TermCard = () => {
  const { term, create } = useTermContext();
  const { name, setTerm, get, update, remove: deleteFoo } = term;
  const dataTerm = get.term;
  const { deleteTerm, isDeleteError, isDeletePending } = deleteFoo;

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const handleDeleteTerm = (term: string) => {
    deleteTerm(term, {
      onSuccess: () => {
        setTerm("");
      },
    });
    setIsDeleteModalOpen(false);
  };

  if (create.status === "active") {
    return (
      <div className="term-card term-card--empty" role="status">
        <p className="eyebrow">Create a Term</p>
        <CreateTermForm />
      </div>
    );
  }

  if (get.isLoading) {
    return <TermCardSkeleton />;
  }

  if (get.isError) {
    return (
      <div className="term-card term-card--empty" role="status">
        <p className="eyebrow">Not found</p>
        <h2>{name}</h2>
        <p>No term card is available for this lookup yet.</p>
      </div>
    );
  }

  if (name.length == 0 || !get.term) {
    return null;
  }

  return (
    get.isSuccess && (
      <article className="term-card">
        <div className="term-card__topline">
          <span>Term</span>
          <span>Glossary</span>
        </div>
        {isEdit && !update.isSuccess ? (
          <UpdateTermForm onEditMode={setIsEdit} />
        ) : (
          <>
            <div className="term-card__title-row">
              <h2>{dataTerm?.name}</h2>
              <button
                aria-label={`Edit ${dataTerm?.name}`}
                className="term-card__title-row-edit-btn"
                type="button"
                onClick={() => setIsEdit(true)}
              >
                <MdOutlineEdit aria-hidden="true" />
              </button>
              <button
                aria-label={`Delete ${dataTerm?.name}`}
                className="term-card__icon-button term-card__delete-button"
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isDeletePending}
              >
                <FiMinus aria-hidden="true" />
              </button>
            </div>

            <div className="term-card__section">
              <h3>Definition</h3>
              <p>{dataTerm?.definition ?? "No definition saved yet."}</p>
            </div>
          </>
        )}

        {isDeleteModalOpen && dataTerm && (
          <DeleteModal
            hasDeleteError={isDeleteError}
            termName={dataTerm.name}
            handleConfirmDelete={() => handleDeleteTerm(dataTerm.name)}
            handleCancelDelete={() => setIsDeleteModalOpen(false)}
            isDeleting={isDeletePending}
          />
        )}

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
    )
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
