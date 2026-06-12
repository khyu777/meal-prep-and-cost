// Formats a gram value for display. Floors intentionally so remaining stock is never overstated.
export function formatGrams(value: number): string {
  return `${Math.floor(value)}g`;
}
