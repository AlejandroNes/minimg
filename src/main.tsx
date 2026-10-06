import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTheme, loadTheme } from "./settings";

applyTheme(loadTheme());

const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontró el elemento raíz de la aplicación.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
