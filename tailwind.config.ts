import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1F3A",
          900: "#071628",
          800: "#122C4F",
          700: "#1C3E68",
        },
        teal: {
          DEFAULT: "#0F766E",
          800: "#115E59",
          100: "#CCFBF1",
          50: "#F0FDFA",
        },
        canvas: "#F3F6FA",
        ink: "#0F172A",
        muted: "#52627A",
        line: "#D8E0EA",
        danger: "#9F1239",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
