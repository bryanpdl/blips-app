import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#17151B",
        primary: "#804FE2",
        secondary: "#FFB444",
        "gray-dark": "#201E25",
        "gray-darker": "#17151B",
        "gray-light": "#9CA3AF",
      },
      fontFamily: {
        sans: ["var(--font-schibsted)"],
      },
    },
  },
  plugins: [],
};

export default config;
