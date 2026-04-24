import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { requirePlantAccess } from '@/lib/plant-server'

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(',')),
  ]
  return lines.join('\n')
}

export async function GET(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const { searchParams } = new URL(request.url)
  const report = searchParams.get('report') || 'daily-production'
  const format = searchParams.get('format') || 'csv'

  const queries: Record<string, { table: string; columns: string }> = {
    'daily-production': { table: 'plant_production_logs', columns: 'date,shift,product_name,sku,qty,unit,machine,operator' },
    'monthly-production': { table: 'plant_production_logs', columns: 'date,shift,product_name,sku,qty,unit,machine,operator' },
    'rm-consumption': { table: 'raw_material_transactions', columns: 'date,type,qty,rate,remarks,material_id' },
    'fg-stock': { table: 'finished_goods_stock', columns: 'product_name,sku,qty,updated_at' },
    'dispatch-summary': { table: 'fg_dispatches', columns: 'date,customer_name,invoice_no,truck_no,destination,product_name,sku,qty,status' },
    'warehouse-stock': { table: 'warehouse_items', columns: 'item_name,sku,category,unit,current_stock,reserved_stock,min_level,unit_rate' },
  }

  const selected = queries[report]
  if (!selected) return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })

  const { data, error } = await access.serviceClient.from(selected.table).select(selected.columns)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = ((data || []) as unknown[]) as Array<Record<string, unknown>>

  if (format === 'pdf') {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : ['No data']
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.text(report.replace(/-/g, ' ').toUpperCase(), 14, 14)
    autoTable(doc, {
      startY: 20,
      head: [headers],
      body: rows.map(row => headers.map(header => String(row[header] ?? ''))),
      styles: { fontSize: 8 },
    })
    return new NextResponse(Buffer.from(doc.output('arraybuffer')), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report}.pdf"`,
      },
    })
  }

  const csv = toCsv(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report}.csv"`,
    },
  })
}
