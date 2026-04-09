const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrTooltip = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatInr(amount: number): string {
  return inr.format(amount)
}

/** INR for chart tooltips (up to 2 decimal places). */
export function formatInrTooltip(amount: number): string {
  return inrTooltip.format(amount)
}
