'use client'

import React, { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Label, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createProjectAction } from '@/lib/actions/projects'
import { Project } from '@/types'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const colorPresets = [
  '#8B7CFF', // Electric Violet (Primary)
  '#22D3EE', // Cyan
  '#34D399', // Emerald
  '#FBBF24', // Amber
  '#F87171', // Rose
  '#A78BFA', // Purple
  '#38BDF8', // Sky Blue
  '#EC4899', // Pink
]

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [selectedColor, setSelectedColor] = useState('#8B7CFF')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    const payload = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      color_hex: selectedColor,
      status: (formData.get('status') as Project['status']) || 'active',
      target_completion_date: (formData.get('target_completion_date') as string) || null,
    }

    startTransition(async () => {
      const res = await createProjectAction(payload)
      if (res.success) {
        toast({
          title: 'Project created',
          message: `"${payload.title}" has been added to your projects.`,
          type: 'success',
        })
        onClose()
        onSuccess?.()
      } else {
        setError(res.error || 'Failed to create project')
      }
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      description="Organize your tasks, track milestones, and visualize progress"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="project-title">Project Title *</Label>
          <Input
            id="project-title"
            name="title"
            required
            maxLength={120}
            placeholder="e.g. Q4 Infrastructure Revamp"
          />
        </div>

        <div>
          <Label htmlFor="project-desc">Description</Label>
          <Textarea
            id="project-desc"
            name="description"
            rows={3}
            placeholder="Key objectives, milestones, and scope..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="project-status">Status</Label>
            <Select id="project-status" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="backlog">Backlog</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="project-target">Target Completion Date</Label>
            <Input
              id="project-target"
              name="target_completion_date"
              type="date"
            />
          </div>
        </div>

        {/* Color Palette Selector */}
        <div>
          <Label>Accent Color</Label>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            {colorPresets.map((hex) => {
              const isSelected = selectedColor.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  type="button"
                  key={hex}
                  onClick={() => setSelectedColor(hex)}
                  className={`w-7 h-7 rounded-full transition-transform border-2 ${
                    isSelected ? 'scale-110 border-white ring-2 ring-[#8B7CFF]' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Select color ${hex}`}
                />
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
