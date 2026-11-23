import { useState, type ReactNode } from "react";
import { TermContext, type CreateStatusEnum } from "./context";
import {
  useCreateTerm,
  useDeleteTerm,
  useFetchTerm,
  useSearchTerm,
  useUpdateTerm,
} from "./hooks";
import { isApiError } from "./actions";

export const TermProvider = ({ children }: { children: ReactNode }) => {
  const [term, setTerm] = useState<string>("");
  const { data, error, isError, isLoading, isSuccess } = useFetchTerm(term);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const {
    data: terms,
    error: searchError,
    isError: isSearchError,
    isLoading: isLoadingSearch,
    isSuccess: isLoadingSuccess,
    isFetching: isFetchingSearch,
    refetch: refetchSearch,
  } = useSearchTerm(searchTerm);

  const [createStatus, setCreateStatus] =
    useState<CreateStatusEnum>("inactive");
  const {
    mutate: createTerm,
    error: createError,
    isPending: isCreatePending,
    reset: resetCreateError,
  } = useCreateTerm();

  const {
    mutate: updateTerm,
    error: updateError,
    isPending: isUpdatePending,
    isSuccess: isUpdateSuccess,
    reset: resetUpdateSuccess,
  } = useUpdateTerm();

  const {
    mutate: deleteTerm,
    error: deleteError,
    isPending: isDeletePending,
    reset: resetDeleteError,
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
            errorMessage: error?.message ?? null,
            errorStatus: isApiError(error) ? error.status : null,
          },
          search: {
            name: searchTerm,
            terms,
            setSearchTerm,
            retry: () => {
              if (searchTerm) void refetchSearch();
            },
            isFetching: isFetchingSearch,
            isError: isSearchError,
            isLoading: isLoadingSearch,
            isSuccess: isLoadingSuccess,
            errorMessage: searchError?.message ?? null,
            errorStatus: isApiError(searchError) ? searchError.status : null,
            errorCode: isApiError(searchError)
              ? searchError.issues[0]?.code ?? null
              : null,
          },
          create: {
            createTerm,
            status: createStatus,
            setStatus: setCreateStatus,
            errorMessage: createError?.message ?? null,
            issues: isApiError(createError) ? createError.issues : [],
            isPending: isCreatePending,
            resetError: resetCreateError,
          },
          update: {
            updateTerm,
            isSuccess: isUpdateSuccess,
            resetUpdateSuccess,
            errorMessage: updateError?.message ?? null,
            issues: isApiError(updateError) ? updateError.issues : [],
            isPending: isUpdatePending,
          },
          remove: {
            deleteTerm,
            deleteErrorMessage: deleteError?.message ?? null,
            isDeletePending,
            resetDeleteError,
          },
        },
      }}
    >
      {children}
    </TermContext.Provider>
  );
};
