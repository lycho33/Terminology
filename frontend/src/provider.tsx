import { useState, type ReactNode } from "react";
import { TermContext, type CreateStatusEnum } from "./context";
import {
  useCreateTerm,
  useDeleteTerm,
  useFetchTerm,
  useUpdateTerm,
} from "./hooks";

export const TermProvider = ({ children }: { children: ReactNode }) => {
  const [term, setTerm] = useState<string>("");

  const { data, isError, isLoading, isSuccess } = useFetchTerm(term);
  const [createStatus, setCreateStatus] =
    useState<CreateStatusEnum>("inactive");
  const { mutate: createTerm } = useCreateTerm();
  const { mutate: updateTerm, isSuccess: isUpdateSuccess } = useUpdateTerm();
  const {
    mutate: deleteTerm,
    isError: isDeleteError,
    isPending: isDeletePending,
  } = useDeleteTerm();

  return (
    <TermContext.Provider
      value={{
        term: {
          name: term,
          setTerm,
          get: {
            term: data,
            isError,
            isLoading,
            isSuccess,
          },
          update: {
            updateTerm,
            isSuccess: isUpdateSuccess,
          },
          remove: {
            deleteTerm,
            isDeleteError,
            isDeletePending,
          },
        },
        create: {
          createTerm,
          status: createStatus,
          setStatus: setCreateStatus,
        },
      }}
    >
      {children}
    </TermContext.Provider>
  );
};
