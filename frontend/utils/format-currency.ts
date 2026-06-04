// Formats a numeric value as a USD currency string (e.g. 1.25 → "$1.25")
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
