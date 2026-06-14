import {
  useMutation,
  useQuery,
  type QueryObserverResult,
} from "@tanstack/react-query";
import { getTerm, updateTerm } from "./actions";
import { TermCard, TermCardSkeleton } from "./terms/Term";
import type { Term } from "./terms/types";

type DataProps = {
  termName: string;
};

const useFetchTerm = (termName: string): QueryObserverResult<Term, unknown> => {
  return useQuery({
    queryKey: ["terms", termName],
    queryFn: () => getTerm(termName),
  });
};

export type UpdateTermInput = {
  term: string;
  newTerm: string;
};

const useUpdateTerm = () => {
  return useMutation({
    mutationFn: (terms: UpdateTermInput) => updateTerm(terms),
  });
};

export const Data = ({ termName }: DataProps) => {
  const { data, isError, isLoading } = useFetchTerm(termName);
  const { mutate: updateTerm, isSuccess } = useUpdateTerm();

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

  if (!data) {
    return null;
  }

  return (
    <TermCard term={data} updateTerm={updateTerm} updateStatus={isSuccess} />
  );
};
