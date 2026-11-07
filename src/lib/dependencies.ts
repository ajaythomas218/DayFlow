/**
 * Task Dependency and Cycle Prevention Logic
 */

export interface DependencyEdge {
  blocking_task_id: string
  dependent_task_id: string
}

/**
 * Cycle Detection Algorithm:
 * Returns true if adding an edge (blockingTaskId -> dependentTaskId)
 * would introduce a directed cycle in the dependency graph.
 *
 * Edge definition: (A -> B) means A blocks B (B depends on A).
 * Adding (A -> B) creates a cycle if and only if there is already a path from B to A.
 */
export function wouldCreateDependencyCycle(
  existingEdges: DependencyEdge[],
  newBlockingTaskId: string,
  newDependentTaskId: string
): boolean {
  if (newBlockingTaskId === newDependentTaskId) {
    return true
  }

  // Build adjacency list: node -> array of nodes it blocks
  const adjacency = new Map<string, string[]>()
  for (const edge of existingEdges) {
    const list = adjacency.get(edge.blocking_task_id) || []
    list.push(edge.dependent_task_id)
    adjacency.set(edge.blocking_task_id, list)
  }

  // BFS search starting from newDependentTaskId to see if we can reach newBlockingTaskId
  const visited = new Set<string>()
  const queue = [newDependentTaskId]
  visited.add(newDependentTaskId)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === newBlockingTaskId) {
      return true // Cycle detected!
    }

    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return false
}

