import { message, LocalizedError } from "../i18n/index.ts";
let activeTasks = 0;
const listeners = new Set<() => void>();
export const getImageActivity = () => activeTasks > 0;
export const subscribeImageActivity = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// La actividad persiste aunque se cierre o cambie el componente de una herramienta.
export async function trackImageTask<T>(task: () => Promise<T>): Promise<T> {
  activeTasks += 1;
  listeners.forEach((listener) => listener());
  try {
    return await task();
  } finally {
    activeTasks -= 1;
    listeners.forEach((listener) => listener());
  }
}

let updateActive = false;
export const getProcessingActivity = () => getImageActivity() || updateActive;

export async function trackUpdateTask<T>(task: () => Promise<T>): Promise<T> {
  if (getProcessingActivity()) throw new LocalizedError(message("imageActivity.waitForTheCurrentOperationTo"));
  updateActive = true;
  try { return await task(); }
  finally { updateActive = false; }
}
