import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function GenerateButton() {
  return (
    <Button className="w-full gap-2 py-5 text-base">
      <Sparkles className="size-4" />
      Generate
    </Button>
  )
}
