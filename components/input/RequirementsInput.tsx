"use client"

import { useRef, useState } from "react"
import { FileText, Link, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export function RequirementsInput() {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        Requirements
      </label>
      <Tabs defaultValue="text">
        <TabsList variant="line">
          <TabsTrigger value="text">
            <FileText />
            Text
          </TabsTrigger>
          <TabsTrigger value="file">
            <Upload />
            File
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-3">
          <Textarea
            placeholder="Paste your requirements, feature description, or any text here..."
            className="min-h-40 resize-y"
          />
        </TabsContent>

        <TabsContent value="file" className="mt-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragOver
                ? "border-ring bg-muted/50"
                : "border-input hover:border-ring hover:bg-muted/30",
            ].join(" ")}
          >
            <Upload className="size-8 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium text-foreground">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop a file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .txt, .md, .pdf, .docx
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-3 flex flex-col gap-1.5">
          <Input
            type="url"
            placeholder="https://confluence.example.com/page/requirements"
          />
          <p className="text-xs text-muted-foreground">
            Paste a URL to a Confluence page, Notion doc, or any public page.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
