/** Split bars into staff-like rows of 4 (musical default). */
export function chunkBars<T>(items: T[], size = 4): T[][] {
  if (items.length === 0) return []
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}
