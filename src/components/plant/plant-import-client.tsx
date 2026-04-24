'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { mergePlantImportPayload, parsePlantWorkbook } from '@/lib/plant-import'

export function PlantImportClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string[]>([])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setLoading(true)
    try {
      const parsedFiles = []

      for (const file of Array.from(fileList)) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        parsedFiles.push(parsePlantWorkbook(file.name, workbook))
      }

      const { payload, notes } = mergePlantImportPayload(parsedFiles)

      const res = await fetch('/api/plant/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      toast({ title: 'Import completed', description: 'Excel data mapped into plant tables.', variant: 'success' })
      setSummary(notes.concat(data.summary || []))
      window.location.reload()
    } catch (error: unknown) {
      toast({ title: 'Import failed', description: error instanceof Error ? error.message : 'Import failed', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function loadSampleData() {
    setLoading(true)
    try {
      const res = await fetch('/api/plant/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sample import failed')
      toast({ title: 'Sample data imported', description: 'Bundled plant demo rows have been loaded.', variant: 'success' })
      setSummary(data.summary || [])
      window.location.reload()
    } catch (error: unknown) {
      toast({ title: 'Sample import failed', description: error instanceof Error ? error.message : 'Sample import failed', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Upload legacy Excel files</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-8 text-center">
            <Upload className="mb-3 h-8 w-8 text-cyan-600" />
            <p className="text-sm font-medium text-gray-900">Select `.xlsx` files</p>
            <p className="mt-1 text-xs text-gray-500">Supported sheets: production, RM report, FG dispatch/stock, item-wise stock</p>
            <input type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </label>
          <Button type="button" variant="outline" onClick={loadSampleData} loading={loading}>
            <Database className="h-4 w-4" />
            Import bundled sample data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Import notes</CardTitle></CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-sm text-gray-500">No import has been run in this session yet.</p>
          ) : (
            <div className="space-y-2 text-sm text-gray-600">
              {summary.map(line => (
                <div key={line} className="rounded-lg bg-gray-50 px-3 py-2">{line}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
