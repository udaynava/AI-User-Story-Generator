"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

const OPTIONS = [
  {
    id: "stories",
    label: "User Stories",
    description: 'As a [user], I want [goal] so that [reason]',
  },
  {
    id: "spikes",
    label: "Spikes",
    description: "Research tasks to explore unknowns before implementation",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Technical subtasks broken down from stories",
  },
]

export function GenerationOptions() {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    stories: true,
    spikes: false,
    tasks: false,
  })

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">Generate</p>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ id, label, description }) => (
          <label
            key={id}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
              selected[id] ? "border-ring bg-muted/30" : "border-border"
            )}
          >
            <Checkbox
              id={id}
              checked={selected[id]}
              onCheckedChange={() => toggle(id)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium leading-none">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
