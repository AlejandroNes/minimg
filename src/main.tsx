import { I18nProvider } from "./i18n/I18nProvider";
import { applyLanguage } from "./i18n/language";
import { translate as t } from "./i18n/index";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTheme, loadTheme } from "./settings";

applyTheme(loadTheme());
applyLanguage();

const root = document.getElementById("root");

if (!root) {
  throw new Error(t("main.theApplicationRootElementWasNot"));
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>,
);
