import { useCreateTerm, useFetchTerm, useUpdateTerm } from "./hooks";
import { CreateTermForm, TermCard, TermCardSkeleton } from "./terms/Term";

type DataProps = {
  termName: string;
  setTerm: (term: string) => void;
};

export const Data = ({ termName, setTerm }: DataProps) => {
  const {
    data,
    isError,
    isLoading,
    isSuccess: isFetchTermSuccess,
  } = useFetchTerm(termName);
  const { mutate: updateTerm, isSuccess: isUpdateSuccess } = useUpdateTerm();
  const { mutate: createTerm, submittedAt } = useCreateTerm();

  if (termName.length == 0 && !submittedAt) {
    return (
      <div className="term-card term-card--empty" role="status">
        <p className="eyebrow">Create a Term</p>
        <CreateTermForm createTerm={createTerm} setTerm={setTerm} />
      </div>
    );
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
    isFetchTermSuccess && (
      <TermCard
        term={data}
        updateTerm={updateTerm}
        updateStatus={isUpdateSuccess}
      />
    )
  );
};
