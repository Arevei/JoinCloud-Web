import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#2FB7FF",
        background: "#000405",
        foreground: "#FFFFFF",
        header: "#000A0D",
        primary: {
          DEFAULT: "#2FB7FF",
          hover: "#5DC8FF",
          soft: "rgba(47, 183, 255, 0.18)",
          foreground: "#000405",
        },
        surface: {
          DEFAULT: "#00080A",
          elevated: "#0A0D11",
        },
        stroke: "#001C25",
        border: {
          DEFAULT: "#001C25",
          light: "#002530",
        },
        muted: {
          DEFAULT: "#3C5056",
          foreground: "#8B9CA3",
        },
        card: {
          DEFAULT: "#00080A",
          foreground: "#FFFFFF",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
