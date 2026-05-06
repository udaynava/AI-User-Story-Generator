import { Textarea } from "@/components/ui/textarea"

export function ContextForm() {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        Additional Context{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <p className="mb-2 text-xs text-muted-foreground">
        Provide project details, tech stack, team conventions, or any other context to improve generation quality.
      </p>
      <Textarea
        placeholder="e.g. We are building a React Native app. Our team follows BDD-style acceptance criteria. Each story should reference Jira ticket format..."
        className="min-h-24 resize-y"
      />
    </div>
  )
}
