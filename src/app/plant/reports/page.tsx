'use client'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const reports = [
  { key: 'daily-production', label: 'Daily Production Report' },
  { key: 'monthly-production', label: 'Monthly Production Report' },
  { key: 'rm-consumption', label: 'RM Consumption Report' },
  { key: 'fg-stock', label: 'FG Stock Report' },
  { key: 'dispatch-summary', label: 'Dispatch Summary' },
  { key: 'warehouse-stock', label: 'Warehouse Stock Report' },
]

export default function PlantReportsPage() {
  const { toast } = useToast()

  async function download(report: string, format: 'csv' | 'pdf') {
    try {
      const res = await fetch(`/api/plant/reports?report=${report}&format=${format}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${report}.${format}`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Plant Reports" description="Generate daily, monthly, stock, dispatch, and warehouse reports in Excel-compatible CSV or PDF." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(report => (
          <Card key={report.key}>
            <CardHeader><CardTitle>{report.label}</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" onClick={() => download(report.key, 'csv')}>Export Excel</Button>
              <Button variant="outline" onClick={() => download(report.key, 'pdf')}>Export PDF</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
