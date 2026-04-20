'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function ReportExportButtons({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  async function exportCSV() {
    setLoading('csv')
    try {
      const res = await fetch(`/api/documents?type=report_csv&businessId=${businessId}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sirpl-report-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'error' })
    } finally {
      setLoading(null)
    }
  }

  async function exportPDF() {
    setLoading('pdf')
    try {
      const res = await fetch(`/api/documents?type=report_pdf&businessId=${businessId}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sirpl-report-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'PDF export failed', variant: 'error' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} loading={loading === 'csv'}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} loading={loading === 'pdf'}>
        <FileText className="h-4 w-4" />
        Export PDF
      </Button>
    </div>
  )
}
