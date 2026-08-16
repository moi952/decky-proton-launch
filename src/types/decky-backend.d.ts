/**
 * Ambient declaration for Decky Loader's global websocket router.
 *
 * `window.DeckyBackend` is created by Decky Loader itself and is the ONLY
 * way to reach loader-level routes such as `utilities/install_plugin`, plus
 * loader lifecycle events (`loader/plugin_download_start|info|finish`).
 *
 * This is distinct from `call`/`callable` in `@decky/api`, which are
 * plugin-scoped and route to this plugin's own Python backend — calling a
 * `utilities/*` route through them throws
 * `'Plugin' object has no attribute 'utilities/install_plugin'`.
 */
export {};

declare global {
  interface DeckyBackendRouter {
    call<Return = unknown, Args extends unknown[] = unknown[]>(
      route: string,
      ...args: Args
    ): Promise<Return>;
    // Loader events carry arbitrary, per-event argument shapes; callers pass
    // precisely-typed listeners. `unknown[]` rest params reject those under
    // strict function-type checking, so this boundary is intentionally `any[]`.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    addEventListener(
      event: string,
      listener: (...args: any[]) => void,
    ): (...args: any[]) => void;
    removeEventListener(
      event: string,
      listener: (...args: any[]) => void,
    ): void;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  interface Window {
    DeckyBackend?: DeckyBackendRouter;
  }
}
