import createGgwave from "./dist/ggwave.mjs";

let modulePromise;

/** Load the ggwave WASM module once and reuse it. */
export function loadGgwave() {
  modulePromise ??= createGgwave().then((m) => {
    m.disableLog();
    return m;
  });
  return modulePromise;
}
