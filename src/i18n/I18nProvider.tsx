import { useEffect, type ReactNode } from "react";
import { useTranslation } from "./useTranslation";
import { applyLanguage } from "./language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const { language, t } = useTranslation();
  useEffect(() => {
    applyLanguage(language);
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("app.description"));
  }, [language, t]);
  return children;
}
