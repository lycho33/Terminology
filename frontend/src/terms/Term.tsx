import { useEffect, useRef, useState } from "react";
import { MdOutlineEdit } from "react-icons/md";
import { VscChromeClose } from "react-icons/vsc";
import type { TermFormProps, UpdateFormProps, TermCardProps } from "./types";

export const TermForm = ({ defaultTerm, onSearch }: TermFormProps) => {
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
          placeholder="Docker"
        />
        <button type="submit">Search</button>
      </div>
    </form>
  );
};

const UpdateTermForm = ({ term, onEditMode, updateTerm }: UpdateFormProps) => {
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

export const TermCard = ({ term, updateTerm, updateStatus }: TermCardProps) => {
  const [isEdit, setIsEdit] = useState<boolean>(false);

  const handleEdit = () => {
    setIsEdit(true);
  };

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
            <MdOutlineEdit
              onClick={handleEdit}
              className="term-card__title-row-edit-btn"
            />
          </>
        ) : (
          <UpdateTermForm
            term={term}
            onEditMode={setIsEdit}
            updateTerm={updateTerm}
          />
        )}
      </div>
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
