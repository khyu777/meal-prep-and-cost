// Formats a unit amount for display. Rounds down to 2 decimals so remaining stock is never overstated.
export function formatUnits(value: number, unit: string): string {
  const rounded = Math.floor(value * 100) / 100;
  return `${rounded} ${unit}`;
}
