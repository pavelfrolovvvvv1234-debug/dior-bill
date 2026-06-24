"use client";

import { createContext, useContext } from "react";

type RowDeleteContextValue = {
  removeRow: () => void;
};

export const RowDeleteContext = createContext<RowDeleteContextValue | null>(null);

export function useOptimisticRowRemove() {
  return useContext(RowDeleteContext)?.removeRow;
}
