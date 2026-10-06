import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { UpdaterController } from "../updater/controller";
import { getImageActivity, subscribeImageActivity, trackUpdateTask } from "../updater/imageActivity";

export function useUpdater(isProcessing: boolean) {
  const tasksRunning = useSyncExternalStore(subscribeImageActivity, getImageActivity);
  const processing = useRef(isProcessing);
  processing.current = isProcessing;
  const [controller] = useState(() => new UpdaterController({
    configured: () => invoke<boolean>("updates_configured"),
    check: async () => {
      const update = await check({ timeout: 15_000 });
      if (!update) return null;
      return {
        version: update.version, body: update.body,
        close: () => update.close(),
        downloadAndInstall: (onEvent, options) => trackUpdateTask(() => update.downloadAndInstall(onEvent, options)),
      };
    },
    relaunch,
  }, () => processing.current || getImageActivity()));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.activate();
    const timer = window.setTimeout(() => void controller.check(true), 2_000);
    return () => {
      window.clearTimeout(timer);
      controller.dispose();
    };
  }, [controller]);

  return { state, controller, isProcessing: isProcessing || tasksRunning };
}

export type AppUpdater = ReturnType<typeof useUpdater>;
