import { useEffect, useRef, useState } from "react";
import { FiMinus } from "react-icons/fi";
import { MdAdd, MdOutlineEdit } from "react-icons/md";
import { VscChromeClose } from "react-icons/vsc";
import { useTermContext } from "../hooks";
import type { DeleteModalProps, UpdateFormProps } from "./types";

export const TermSearchForm = () => {
  const { term } = useTermContext();
  const { setTerm, create } = term;
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (searchTerm) {
      setTerm(searchTerm.trim());
      create.setStatus("inactive");
    }
  };

  const handleSubmitClick = () => {
    create.resetError();
    create.setStatus("active");
  };

  return (
    <form className="term-search" onSubmit={handleSearchSubmit}>
      <label htmlFor="term">Lookup term</label>
      <div className="term-search__controls">
        <input
          id="term"
          type="text"
          name="term"
          value={searchTerm}
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
  const { term } = useTermContext();
  const { setTerm, create } = term;

  const [newTerm, setNewTerm] = useState<string>("");
  const [newDefinition, setNewDefinition] = useState<string>("");
  const [newDiagram, setNewDiagram] = useState<string>("");

  const handleTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTerm(e.target.value);
  };

  const handleDefinitionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setNewDefinition(e.target.value);
  };

  const handleDiagramChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewDiagram(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();
    const nextDefinition = newDefinition.trim();
    const nextDiagram = newDiagram.trim();

    if (nextTerm) {
      create.setStatus("pending");
      create.createTerm(
        {
          name: nextTerm,
          definition: nextDefinition || undefined,
          diagram: nextDiagram || undefined,
        },
        {
          onSuccess: () => {
            setTerm(nextTerm);
            create.setStatus("complete");
          },
          onError: () => {
            create.setStatus("error");
          },
        },
      );
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
        <div className="term-card__definition-editor">
          <label className="term-card__definition-label" htmlFor="diagram">
            Diagram
          </label>
          <textarea
            className="term-card__definition-input"
            id="diagram"
            name="diagram"
            value={newDiagram}
            onChange={handleDiagramChange}
            placeholder="No diagram saved yet."
            rows={3}
          />
        </div>
      </div>
      {create.status === "error" && create.errorMessage && (
        <p className="term-card__mutation-error" role="alert">
          {create.errorMessage}
        </p>
      )}
      <div className="term-card__create-actions">
        <button
          className="term-card__update-button"
          type="submit"
          disabled={create.isPending}
        >
          {create.isPending ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
};

const UpdateTermForm = ({ onEditMode }: UpdateFormProps) => {
  const { term } = useTermContext();
  const { name, get, setTerm, update } = term;

  const [newTerm, setNewTerm] = useState<string>(name);
  const [newDefinition, setNewDefinition] = useState<string | undefined>(
    get.term?.definition ?? "",
  );
  const [newDiagram, setNewDiagram] = useState<string | undefined>(
    get.term?.diagram ?? "",
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

  const handleDiagramChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewDiagram(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTerm = newTerm.trim();
    const nextDefinition = newDefinition?.trim();
    const nextDiagram = newDiagram?.trim();

    if (nextTerm) {
      update.updateTerm(
        {
          term: name,
          newTerm: nextTerm,
          definition: nextDefinition,
          diagram: nextDiagram,
        },
        {
          onSuccess: () => {
            setTerm(nextTerm);
            onEditMode(false);
            update.resetUpdateSuccess();
          },
        },
      );
    }
  };

  const handleCancelUpdate = () => {
    update.resetUpdateSuccess();
    onEditMode(false);
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
        <button
          className="term-card__update-button"
          type="submit"
          disabled={update.isPending}
        >
          {update.isPending ? "Updating..." : "Update"}
        </button>
        <button
          aria-label="Cancel update"
          className="term-card__icon-button"
          type="button"
          onClick={handleCancelUpdate}
          disabled={update.isPending}
        >
          <VscChromeClose aria-hidden="true" />
        </button>
      </div>
      {update.errorMessage && (
        <p className="term-card__mutation-error" role="alert">
          {update.errorMessage}
        </p>
      )}
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
      <div className="term-card__definition-editor">
        <label className="term-card__definition-label" htmlFor="diagram">
          Diagram
        </label>
        <textarea
          className="term-card__definition-input"
          id="diagram"
          name="diagram"
          value={newDiagram}
          onChange={handleDiagramChange}
          placeholder="No diagram saved yet."
          rows={3}
        />
      </div>
    </form>
  );
};

const DeleteModal = ({
  deleteErrorMessage,
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
        {deleteErrorMessage && (
          <p className="term-card__delete-error" role="alert">
            {deleteErrorMessage}
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
  const { term } = useTermContext();
  const { name, setTerm, get, create, update, remove: deleteTermById } = term;
  const dataTerm = get.term;
  const { deleteTerm, deleteErrorMessage, isDeletePending, resetDeleteError } =
    deleteTermById;

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const handleDeleteTerm = (term_id: string) => {
    deleteTerm(term_id, {
      onSuccess: () => {
        setTerm("");
        setIsDeleteModalOpen(false);
      },
    });
  };

  const handleOpenDeleteModal = () => {
    resetDeleteError();
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    resetDeleteError();
    setIsDeleteModalOpen(false);
  };

  const handleOpenEdit = () => {
    update.resetUpdateSuccess();
    setIsEdit(true);
  };

  if (
    create.status === "active" ||
    create.status === "pending" ||
    create.status === "error"
  ) {
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
    const isMissingTerm = get.errorStatus === 404;

    return (
      <div
        className="term-card term-card--empty"
        role={isMissingTerm ? "status" : "alert"}
      >
        <p className="eyebrow">
          {isMissingTerm ? "Not found" : "Lookup failed"}
        </p>
        <h2>{name}</h2>
        <p>
          {isMissingTerm
            ? "No term card is available for this lookup yet."
            : (get.errorMessage ?? "Unable to reach the Terminology API.")}
        </p>
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
                onClick={handleOpenEdit}
              >
                <MdOutlineEdit aria-hidden="true" />
              </button>
              <button
                aria-label={`Delete ${dataTerm?.name}`}
                className="term-card__icon-button term-card__delete-button"
                type="button"
                onClick={handleOpenDeleteModal}
                disabled={isDeletePending}
              >
                <FiMinus aria-hidden="true" />
              </button>
            </div>

            <div className="term-card__section">
              <h3>Definition</h3>
              <p>{dataTerm?.definition ?? "No definition saved yet."}</p>
            </div>

            <div className="term-card__section">
              <h3>Diagram</h3>
              <p>{dataTerm?.diagram ?? "No diagram saved yet."}</p>
            </div>
          </>
        )}

        {isDeleteModalOpen && dataTerm && (
          <DeleteModal
            deleteErrorMessage={deleteErrorMessage}
            termName={dataTerm.name}
            handleConfirmDelete={() =>
              dataTerm.id && handleDeleteTerm(dataTerm.id)
            }
            handleCancelDelete={handleCancelDelete}
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
