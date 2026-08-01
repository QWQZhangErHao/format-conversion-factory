/**
 * Ambient type declarations for @convert/core.
 *
 * Vite-style worker imports (`./foo.worker?worker`) are used by worker-client.ts.
 * The core package does not depend on vite, so declare the module shape here
 * instead of referencing `vite/client`.
 */
declare module '*?worker' {
  const WorkerConstructor: { new (): Worker }
  export default WorkerConstructor
}
