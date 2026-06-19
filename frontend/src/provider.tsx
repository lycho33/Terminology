import { type ReactNode, useState } from "react";
import { TermContext, type CreateStatusEnum } from "./context";

export const TermProvider = ({ children }: { children: ReactNode }) => {
  const [term, setTerm] = useState<string>("");
  const [createStatus, setCreateStatus] =
    useState<CreateStatusEnum>("inactive");

  return (
    <TermContext.Provider
      value={{ term, setTerm, createStatus, setCreateStatus }}
    >
      {children}
    </TermContext.Provider>
  );
};
