import { create } from "zustand";
import {
  DIOR_PRELOADER_FADE_MS,
  DIOR_PRELOADER_HOLD_MS,
  sleep,
  waitUntilLeftAuthPages,
} from "@/lib/dior-preloader-timing";

export type PreloaderPhase = "hidden" | "visible" | "completing" | "fadeout";

type PreloaderStore = {
  phase: PreloaderPhase;
  startedAt: number | null;
  show: () => void;
  cancel: () => void;
  /** Navigate away from auth, keep overlay until dashboard loads, then fade out. */
  finishAuthTransition: (startedAt: number, navigate: () => void) => Promise<void>;
};

function setBodyActive(active: boolean) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("preloader-active", active);
}

export const usePreloaderStore = create<PreloaderStore>((set, get) => ({
  phase: "hidden",
  startedAt: null,

  show() {
    const startedAt = Date.now();
    set({ phase: "visible", startedAt });
    setBodyActive(true);
  },

  cancel() {
    const phase = get().phase;
    if (phase === "completing" || phase === "fadeout") return;

    set({ phase: "hidden", startedAt: null });
    setBodyActive(false);
  },

  async finishAuthTransition(startedAt: number, navigate: () => void) {
    if (get().phase === "hidden") {
      get().show();
    }

    set({ phase: "completing" });
    navigate();

    const elapsed = Date.now() - startedAt;
    const holdRemaining = Math.max(0, DIOR_PRELOADER_HOLD_MS - elapsed);
    await sleep(holdRemaining);

    await waitUntilLeftAuthPages();

    set({ phase: "fadeout" });
    await sleep(DIOR_PRELOADER_FADE_MS);

    set({ phase: "hidden", startedAt: null });
    setBodyActive(false);
  },
}));
