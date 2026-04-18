// Captured at module-load time — import this before any other app module
// to get the earliest possible JS-side timestamp for cold-start measurement.
export const APP_START_MS = performance.now();
