/**
 * Project and Task Metric Calculations
 */

/**
 * Calculates project completion progress.
 * Documented Formula:
 * - If totalTasks === 0 -> 0%
 * - Otherwise: Math.round((completedTasks / totalTasks) * 100)
 */
export function calculateProjectProgress(totalTasks: number, completedTasks: number): number {
  if (totalTasks <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((completedTasks / totalTasks) * 100)))
}

