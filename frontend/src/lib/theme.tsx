import { createContext, useContext } from "react";

export type ThemeName = "dark" | "light";

export const ThemeContext = createContext<ThemeName>("dark");

export function useTheme(): ThemeName {
  return useContext(ThemeContext);
}
