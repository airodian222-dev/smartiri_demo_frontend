import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";

interface ThemeCtx {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  dark: boolean;
  colors: { series: string[]; grid: string; axis: string; ink: string; ink2: string; muted: string; surface: string; good: string; bad: string; warn: string; line: string; brand: string; brand2: string; violet: string };
}

const Ctx = createContext<ThemeCtx>(null as unknown as ThemeCtx);
const KEY = "smartiri.theme";

function readColors(): ThemeCtx["colors"] {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const rgb = (n: string) => `rgb(${v(n).split(" ").join(",")})`;
  return {
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
    grid: v("--grid"),
    axis: v("--axis"),
    ink: rgb("--ink"),
    ink2: rgb("--ink2"),
    muted: rgb("--muted"),
    brand: rgb("--brand"),
    brand2: rgb("--brand2"),
    violet: rgb("--violet"),
    surface: rgb("--surface"),
    good: rgb("--good"),
    bad: rgb("--bad"),
    warn: rgb("--warn"),
    line: rgb("--line"),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemePref) || "dark";
    } catch {
      return "dark";
    }
  });
  const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [colors, setColors] = useState<ThemeCtx["colors"]>(() => readColors());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => setSysDark(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const dark = pref === "dark" || (pref === "system" && sysDark);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    setColors(readColors());
  }, [dark]);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ pref, setPref, dark, colors }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
