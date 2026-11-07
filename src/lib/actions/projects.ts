'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createProjectSchema, updateProjectSchema } from '@/lib/validations/projects'
import { calculateProjectProgress } from '@/lib/calculations'
import { ActionResponse, Project, Task } from '@/types'

export type ProjectWithProgress = Project & {
  total_tasks: number
  completed_tasks: number
  progress_percentage: number
}

export async function getProjectsAction(statusFilter?: string): Promise<ActionResponse<ProjectWithProgress[]>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    let query = supabase
      .from('projects')
      .select('*, tasks(id, status)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      // @ts-expect-error Supabase typed query
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    type ProjectQueryRow = Project & { tasks?: Array<{ id: string; status: string }> }

    const projectsWithProgress: ProjectWithProgress[] = ((data as unknown as ProjectQueryRow[]) || []).map((p) => {
      const taskList = p.tasks || []
      const total_tasks = taskList.length
      const completed_tasks = taskList.filter((t) => t.status === 'completed').length
      const progress_percentage = calculateProjectProgress(total_tasks, completed_tasks)

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tasks, ...projectData } = p
      return {
        ...projectData,
        total_tasks,
        completed_tasks,
        progress_percentage,
      }
    })

    return { success: true, data: projectsWithProgress }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch projects'
    return { success: false, error: msg }
  }
}

export async function getProjectByIdAction(projectId: string): Promise<
  ActionResponse<{
    project: ProjectWithProgress
    tasks: Task[]
  }>
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !projectData) {
      return { success: false, error: projectError?.message || 'Project not found' }
    }

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (tasksError) {
      return { success: false, error: tasksError.message }
    }

    const tasks = (tasksData || []) as Task[]
    const total_tasks = tasks.length
    const completed_tasks = tasks.filter((t) => t.status === 'completed').length
    const progress_percentage = calculateProjectProgress(total_tasks, completed_tasks)

    const project: ProjectWithProgress = {
      ...(projectData as Project),
      total_tasks,
      completed_tasks,
      progress_percentage,
    }

    return { success: true, data: { project, tasks } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load project details'
    return { success: false, error: msg }
  }
}

export async function createProjectAction(rawInput: unknown): Promise<ActionResponse<Project>> {
  try {
    const parsed = createProjectSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid project data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const insertPayload = {
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      color_hex: parsed.data.color_hex,
      status: parsed.data.status,
      target_completion_date: parsed.data.target_completion_date || null,
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')

    return { success: true, data: data as Project }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create project'
    return { success: false, error: msg }
  }
}

export async function updateProjectAction(rawInput: unknown): Promise<ActionResponse<Project>> {
  try {
    const parsed = updateProjectSchema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid project data' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { id, ...updateFields } = parsed.data

    const { data, error } = await supabase
      .from('projects')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    revalidatePath('/dashboard')

    return { success: true, data: data as Project }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update project'
    return { success: false, error: msg }
  }
}

export async function archiveProjectAction(projectId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { error } = await supabase
      .from('projects')
      .update({ status: 'archived' })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${projectId}`)
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to archive project'
    return { success: false, error: msg }
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete project'
    return { success: false, error: msg }
  }
}
