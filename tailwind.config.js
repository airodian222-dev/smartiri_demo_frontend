/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: v("page"),
        surface: v("surface"),
        raised: v("raised"),
        line: v("line"),
        ink: v("ink"),
        ink2: v("ink2"),
        muted: v("muted"),
        brand: v("brand"),
        brand2: v("brand2"),
        iris: v("violet"),
        brandink: v("brandink"),
        good: v("good"),
        warn: v("warn"),
        bad: v("bad"),
        serious: v("serious"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      opacity: { 6: "0.06", 8: "0.08", 12: "0.12", 14: "0.14", 35: "0.35", 45: "0.45", 55: "0.55", 65: "0.65", 85: "0.85" },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--brand) / 0.35), 0 8px 30px -8px rgb(var(--brand) / 0.55)",
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -18px rgb(0 0 0 / 0.55)",
      },
      keyframes: {
        ping2: { "75%, 100%": { transform: "scale(2.2)", opacity: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        ping2: "ping2 1.8s cubic-bezier(0,0,0.2,1) infinite",
        rise: "rise .35s ease-out both",
      },
    },
  },
  plugins: [],
};
