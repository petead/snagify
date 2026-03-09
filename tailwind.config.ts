import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        brand: {
          purple: "#9A88FD",
          "purple-dark": "#7B65FC",
          green: "#cafe87",
          yellow: "#FEDE80",
          white: "#fcfcfc",
          dark: "#1A1A1A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
