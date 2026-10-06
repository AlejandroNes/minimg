import { productName, bundle } from "../src-tauri/tauri.conf.json";

// El nombre público se define en Tauri y se comparte con la interfaz.
export const APP_NAME = productName;
export const APP_DESCRIPTION = bundle.shortDescription;
export const APP_DEVELOPER = bundle.publisher;
export const APP_COPYRIGHT = bundle.copyright;
export const APP_LICENSE = "GNU GPL v3.0";
export const APP_LINKS = {
  website: bundle.homepage,
  terms: "https://nesvatek.com/products/minimg/legal/terms",
  privacy: "https://nesvatek.com/products/minimg/legal/privacy",
  // Configurar la URL real y su permiso opener cuando exista el repositorio.
  github: null as string | null,
};
