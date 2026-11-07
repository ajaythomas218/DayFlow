import { describe, it, expect } from 'vitest'
import { wouldCreateDependencyCycle, DependencyEdge } from '@/lib/dependencies'

describe('Task Dependencies & Cycle Prevention Logic', () => {
  it('detects a self-dependency as an immediate invalid cycle', () => {
    const existingEdges: DependencyEdge[] = []
    const result = wouldCreateDependencyCycle(existingEdges, 'task-A', 'task-A')
    expect(result).toBe(true)
  })

  it('permits a standard valid single dependency (A blocks B)', () => {
    const existingEdges: DependencyEdge[] = []
    const result = wouldCreateDependencyCycle(existingEdges, 'task-A', 'task-B')
    expect(result).toBe(false)
  })

  it('detects direct 2-node cycle (A blocks B, trying to add B blocks A)', () => {
    // Existing: A -> B (A blocks B)
    const existingEdges: DependencyEdge[] = [
      { blocking_task_id: 'task-A', dependent_task_id: 'task-B' },
    ]

    // Candidate: B -> A (B blocks A)
    const wouldCycle = wouldCreateDependencyCycle(existingEdges, 'task-B', 'task-A')
    expect(wouldCycle).toBe(true)
  })

  it('detects transitive multi-node cycle (A -> B -> C -> D, trying to add D -> A)', () => {
    const existingEdges: DependencyEdge[] = [
      { blocking_task_id: 'task-A', dependent_task_id: 'task-B' },
      { blocking_task_id: 'task-B', dependent_task_id: 'task-C' },
      { blocking_task_id: 'task-C', dependent_task_id: 'task-D' },
    ]

    // Candidate: D -> A would close the loop A -> B -> C -> D -> A
    const wouldCycle = wouldCreateDependencyCycle(existingEdges, 'task-D', 'task-A')
    expect(wouldCycle).toBe(true)

    // Intermediate candidate: C -> A would also close a loop
    expect(wouldCreateDependencyCycle(existingEdges, 'task-C', 'task-A')).toBe(true)
  })

  it('permits valid branching tree without cycles', () => {
    // Graph: A blocks B and C; B blocks D; C blocks E
    const existingEdges: DependencyEdge[] = [
      { blocking_task_id: 'task-A', dependent_task_id: 'task-B' },
      { blocking_task_id: 'task-A', dependent_task_id: 'task-C' },
      { blocking_task_id: 'task-B', dependent_task_id: 'task-D' },
      { blocking_task_id: 'task-C', dependent_task_id: 'task-E' },
    ]

    // Adding E blocks F is valid
    expect(wouldCreateDependencyCycle(existingEdges, 'task-E', 'task-F')).toBe(false)

    // Adding B blocks E is valid (DAG, no cycle)
    expect(wouldCreateDependencyCycle(existingEdges, 'task-B', 'task-E')).toBe(false)
  })

  it('permits diamond DAG topologies (A blocks B, A blocks C, both B and C block D)', () => {
    // Diamond:
    //      A
    //     / \
    //    B   C
    //     \ /
    //      D
    const existingEdges: DependencyEdge[] = [
      { blocking_task_id: 'task-A', dependent_task_id: 'task-B' },
      { blocking_task_id: 'task-A', dependent_task_id: 'task-C' },
      { blocking_task_id: 'task-B', dependent_task_id: 'task-D' },
    ]

    // Adding C -> D creates diamond, not a cycle
    expect(wouldCreateDependencyCycle(existingEdges, 'task-C', 'task-D')).toBe(false)
  })

  it('rejects attempt to reverse edge in diamond topology', () => {
    const existingEdges: DependencyEdge[] = [
      { blocking_task_id: 'task-A', dependent_task_id: 'task-B' },
      { blocking_task_id: 'task-A', dependent_task_id: 'task-C' },
      { blocking_task_id: 'task-B', dependent_task_id: 'task-D' },
      { blocking_task_id: 'task-C', dependent_task_id: 'task-D' },
    ]

    // Attempting D -> A would cycle
    expect(wouldCreateDependencyCycle(existingEdges, 'task-D', 'task-A')).toBe(true)
    // Attempting D -> B would cycle
    expect(wouldCreateDependencyCycle(existingEdges, 'task-D', 'task-B')).toBe(true)
  })
})

