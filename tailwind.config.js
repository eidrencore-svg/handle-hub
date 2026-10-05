/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090f",
          900: "#0b1020",
          800: "#12182b",
          700: "#1a2238",
          600: "#24304a",
        },
        accent: {
          DEFAULT: "#7c6cff",
          soft: "#a99bff",
          glow: "#5b8cff",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(124, 108, 255, 0.25)",
        card: "0 10px 40px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124, 108, 255, 0.28), transparent 60%), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(91, 140, 255, 0.18), transparent 50%), radial-gradient(ellipse 40% 30% at 10% 20%, rgba(56, 189, 248, 0.12), transparent 50%)",
      },
    },
  },
  plugins: [],
};
