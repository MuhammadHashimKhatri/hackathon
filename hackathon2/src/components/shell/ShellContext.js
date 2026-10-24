"use client";

import { createContext, useContext } from "react";

export const ShellContext = createContext({ closeNav() {}, openAssistant() {} });

export function useShell() {
  return useContext(ShellContext);
}
