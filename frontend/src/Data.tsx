import {
  useCreateTerm,
  useDeleteTerm,
  useFetchTerm,
  useUpdateTerm,
} from "./hooks";
import { CreateTermForm, TermCard, TermCardSkeleton } from "./terms/Term";

type DataProps = {
  isCreating: boolean;
  onCreateComplete: () => void;
  termName: string;
  setTerm: (term: string) => void;
};

export const Data = ({
  isCreating,
  onCreateComplete,
  termName,
  setTerm,
}: DataProps) => {
  const {
    data,
    isError,
    isLoading,
    isSuccess: isFetchSuccess,
  } = useFetchTerm(termName);
  const { mutate: updateTerm, isSuccess: isUpdateSuccess } = useUpdateTerm();
  const { mutate: createTerm } = useCreateTerm();
  const {
    mutate: deleteTerm,
    isError: isDeleteError,
    isPending: isDeletePending,
  } = useDeleteTerm();

  const handleDeleteTerm = (term: string) => {
    deleteTerm(term, {
      onSuccess: () => {
        setTerm("");
      },
    });
  };

  if (isCreating) {
    return (
      <div className="term-card term-card--empty" role="status">
        <p className="eyebrow">Create a Term</p>
        <CreateTermForm
          createTerm={createTerm}
          onCreateComplete={onCreateComplete}
          setTerm={setTerm}
        />
      </div>
    );
  }

  if (termName.length == 0) {
    return null;
  }

  if (isLoading) {
    return <TermCardSkeleton />;
  }

  if (isError) {
    return (
      <div className="term-card term-card--empty" role="status">
        <p className="eyebrow">Not found</p>
        <h2>{termName}</h2>
        <p>No term card is available for this lookup yet.</p>
      </div>
    );
  }

  return (
    isFetchSuccess && (
      <TermCard
        term={data}
        updateTerm={updateTerm}
        updateStatus={isUpdateSuccess}
        setTerm={setTerm}
        deleteTerm={handleDeleteTerm}
        isDeleting={isDeletePending}
        hasDeleteError={isDeleteError}
      />
    )
  );
};
