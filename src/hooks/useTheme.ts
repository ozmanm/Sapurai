import { useState, useEffect } from 'react';

var STORAGE_KEY = "lt-theme";

function getInitialTheme(): "dark" | "light" {
  var stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function useTheme() {
  var [theme, setTheme] = useState(getInitialTheme);

  useEffect(function () {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(function (prev) { return prev === "dark" ? "light" : "dark"; });
  }

  return { theme: theme, toggleTheme: toggleTheme };
}
