/// <reference types="vite/client" />
declare const __SULO_WEB_FAKE__: boolean;
declare const __SULO_DEV__: boolean;
declare const __SULO_VERSION__: string;
/** The short commit this build is made from ("+" when built from a changed tree). */
declare const __SULO_COMMIT__: string;

// The extension's demo attendance (a plain .mjs used by its screenshot scripts).
declare module '*/demo-presensi.mjs' {
  export function demoPresensi(now?: number): Record<string, unknown>;
}

// The extension's synthetic NEOSIA snapshots (made-up names and grades).
declare module '*/demo-neosia.mjs' {
  export function demoNeosia(now?: number): Record<string, unknown>;
}
