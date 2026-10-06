export type UpdatePhase = "idle" | "unconfigured" | "checking" | "current" | "available" | "downloading" | "installing" | "installed" | "error";

export interface DownloadEvent {
  event: "Started" | "Progress" | "Finished";
  data?: { contentLength?: number; chunkLength?: number };
}

export interface UpdateHandle {
  version: string;
  body?: string;
  downloadAndInstall: (onEvent: (event: DownloadEvent) => void, options: { timeout: number }) => Promise<void>;
  close: () => Promise<void>;
}

export interface UpdaterApi {
  configured: () => Promise<boolean>;
  check: () => Promise<UpdateHandle | null>;
  relaunch: () => Promise<void>;
}

export interface UpdateState {
  phase: UpdatePhase;
  update: { version: string; notes?: string } | null;
  promptOpen: boolean;
  downloaded: number;
  total?: number;
  message: string;
}

const initialState: UpdateState = {
  phase: "idle", update: null, promptOpen: false, downloaded: 0, message: "",
};
const details = (error: unknown) => error instanceof Error ? error.message : String(error);

// El controlador permite probar consentimiento, errores y recursos sin instalar software.
export class UpdaterController {
  private api: UpdaterApi;
  private isBusy: () => boolean;
  private state: UpdateState = initialState;
  private listeners = new Set<() => void>();
  private handle: UpdateHandle | null = null;
  private running = false;
  private restarting = false;
  private generation = 0;
  private active = true;

  constructor(api: UpdaterApi, isBusy: () => boolean) {
    this.api = api;
    this.isBusy = isBusy;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private set(patch: Partial<UpdateState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private async close(handle: UpdateHandle | null) {
    if (handle) await handle.close().catch(() => {});
  }
  activate() { this.active = true; }
  dispose() {
    this.active = false;
    this.generation += 1;
    if (!this.running) {
      void this.close(this.handle);
      this.handle = null;
    }
  }

  check = async (silent = false) => {
    if (this.running || !this.active || this.state.phase === "installed") return;
    this.running = true;
    const generation = this.generation;
    this.set({ ...initialState, phase: "checking" });
    try {
      await this.close(this.handle);
      this.handle = null;
      const configured = await this.api.configured();
      if (!this.active || generation !== this.generation) return;
      if (!configured) {
        this.set({ phase: "unconfigured", message: "Las actualizaciones estarán disponibles cuando se configure la distribución pública." });
        return;
      }
      const update = await this.api.check();
      if (!this.active || generation !== this.generation) {
        await this.close(update);
        return;
      }
      this.handle = update;
      if (update) {
        this.set({ phase: "available", update: { version: update.version, notes: update.body }, promptOpen: true });
      } else {
        this.set({ phase: "current", message: silent ? "" : "Ya tienes la última versión disponible." });
      }
    } catch (error) {
      if (generation === this.generation) this.set({
        phase: silent ? "idle" : "error",
        message: silent ? "" : `No se pudieron comprobar las actualizaciones. Comprueba tu conexión e inténtalo de nuevo. ${details(error)}`,
      });
    } finally {
      this.running = false;
    }
  };

  later = () => {
    if (this.running) return;
    // Conserva la oferta para retomarla desde Configuración durante esta sesión.
    this.set({ promptOpen: false });
  };
  show = () => { if (this.state.update) this.set({ promptOpen: true }); };

  install = async () => {
    if (this.running || !this.handle || !this.active) return;
    if (this.isBusy()) {
      this.set({ message: "Espera a que termine el procesamiento de imágenes para actualizar." });
      return;
    }
    this.running = true;
    const update = this.handle;
    this.set({ phase: "downloading", promptOpen: true, downloaded: 0, total: undefined, message: "" });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") this.set({ total: event.data?.contentLength });
        if (event.event === "Progress") this.set({ downloaded: this.state.downloaded + (event.data?.chunkLength ?? 0) });
        if (event.event === "Finished") this.set({ phase: "installing" });
      }, { timeout: 120_000 });
      // Windows cierra la aplicación al iniciar el instalador. macOS requiere reinicio.
      this.handle = null;
      await this.close(update);
      this.set({ phase: "installed", message: "Actualización instalada. Reiniciando la aplicación…" });
      if (this.active) await this.restart();
    } catch (error) {
      this.set({ phase: "error", message: `No se pudo descargar o instalar la actualización. Puedes volver a intentarlo. ${details(error)}` });
    } finally {
      this.running = false;
      if (!this.active) {
        await this.close(this.handle);
        this.handle = null;
      }
    }
  };

  restart = async () => {
    if (!this.active || this.restarting || this.state.phase !== "installed" || this.isBusy()) return;
    this.restarting = true;
    try {
      await this.api.relaunch();
    } catch (error) {
      this.set({ message: `La actualización está instalada, pero no se pudo reiniciar. Reinicia la aplicación para usarla. ${details(error)}` });
    } finally {
      this.restarting = false;
    }
  };
}
