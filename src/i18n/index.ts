import { es, type TranslationKey } from "./es.ts";
import { en } from "./en.ts";
import { getLanguage, type Language } from "./language.ts";

export type MessageValue = string | number | null | undefined | Error | Message | NativeError | readonly MessageValue[];
export interface Message { key: TranslationKey; params?: Record<string, MessageValue> }
export interface NativeError { code: string; params?: Record<string, MessageValue> }
export type Translator = (key: TranslationKey, params?: Record<string, MessageValue>) => string;
export class LocalizedError extends Error {
  readonly descriptor: Message;
  constructor(descriptor: Message) {
    super(translate(descriptor.key, descriptor.params));
    this.descriptor = descriptor;
  }
}
export function message(key: TranslationKey, params?: Record<string, MessageValue>): Message { return { key, params }; }

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, language = getLanguage()): string {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", options).format(value);
}
export function translate(key: TranslationKey, params?: Record<string, MessageValue>, language: Language = getLanguage()): string {
  if (key.endsWith(".other") && typeof params?.count === "number") {
    const category = new Intl.PluralRules(language).select(params.count);
    const variant = `${key.slice(0, -6)}.${category}` as TranslationKey;
    if (variant in es) key = variant;
  }
  const template: string = (language === "en" ? en[key] : es[key]) ?? es[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params?.[name];
    if (value === undefined) return match;
    return typeof value === "number" ? formatNumber(value, undefined, language) : renderMessage(value, language);
  });
}
export function plural(key: TranslationKey, count: number, params?: Record<string, MessageValue>): string {
  const category = new Intl.PluralRules(getLanguage()).select(count);
  const variant = `${key.replace(/\.(one|other)$/, "")}.${category}` as TranslationKey;
  return translate(variant in es ? variant : key, { ...params, count });
}
export function renderMessage(value: MessageValue | Error | unknown, language: Language = getLanguage()): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(part => renderMessage(part, language)).join("");
  if (value instanceof LocalizedError) return renderMessage(value.descriptor, language);
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    if ("key" in value) { const item = value as Message; return translate(item.key, { detail: "", ...item.params }, language); }
    if ("code" in value) {
      const item = value as NativeError;
      const key = `errors.${item.code}` as TranslationKey;
      return translate(key in es ? key : "errors.unknown", { detail: "", ...item.params }, language);
    }
    return translate("errors.unknown", { detail: "" }, language);
  }
  return String(value);
}
