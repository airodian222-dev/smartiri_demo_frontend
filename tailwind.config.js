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
        brandink: v("brandink"),
        good: v("good"),
        warn: v("warn"),
        bad: v("bad"),
        serious: v("serious"),
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
