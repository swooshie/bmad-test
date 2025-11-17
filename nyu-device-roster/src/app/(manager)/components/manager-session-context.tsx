"use client";

import { createContext, useContext } from "react";

type ManagerSession = {
  email: string | null;
  name: string | null;
};

const ManagerSessionContext = createContext<ManagerSession>({
  email: null,
  name: null,
});

export const ManagerSessionProvider = ({
  value,
  children,
}: {
  value: ManagerSession;
  children: React.ReactNode;
}) => (
  <ManagerSessionContext.Provider value={value}>
    {children}
  </ManagerSessionContext.Provider>
);

export const useManagerSession = () => useContext(ManagerSessionContext);
