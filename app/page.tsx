import { createClient } from '@/lib/supabase/client';
import { ContextForm } from "@/components/input/ContextForm";
import { GenerationOptions } from "@/components/input/GenerationOptions";
import { GenerateButton } from "@/components/input/GenerateButton";
import { RequirementsInput } from "@/components/input/RequirementsInput";

export default function Input() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          AI User Story Generator
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Describe your feature and generate user stories, spikes, and tasks.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <RequirementsInput />
        {/* <ContextForm /> */}
        {/* <GenerationOptions /> */}
        <GenerateButton />
      </div>
    </main>
  );
}
