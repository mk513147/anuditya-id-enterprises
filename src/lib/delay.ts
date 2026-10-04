/** Simulated network latency for mock repositories. */
export const delay = (ms = 450) => new Promise<void>((resolve) => setTimeout(resolve, ms))
