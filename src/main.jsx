import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { applyTheme, readThemePref } from "./prefs.js";
import "./styles/app.css";

applyTheme(readThemePref());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
