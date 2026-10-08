import { useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeLanguage } from "./language";
import { translate, plural, renderMessage, formatNumber } from "./index";

export function useTranslation() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return { language, setLanguage, t: translate, plural, text: renderMessage, number: formatNumber };
}
