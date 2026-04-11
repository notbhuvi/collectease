import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { demoInvoices } from '@/lib/demo-data'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'

const statusVariant: Record<string, 'default' | 'success' | 'destructive' | 'secondary' | 'warning'> = {
  draft: 'secondary', sent: 'default', paid: 'success', overdue: 'destructive', cancelled: 'secondary',
}

export default function DemoInvoicesPage() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Manage and track all your invoices"
        actions={<Button><Plus className="h-4 w-4" />New Invoice</Button>}
      />
      <InvoiceFilters currentFilter="all" />
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Due Date</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {demoInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                      {inv.description && <p className="text-xs text-gray-400 truncate max-w-[160px]">{inv.description}</p>}
                    </td>
                    <td className="px-4 py-4 text-gray-700">{inv.client?.name}</td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">{formatDate(inv.due_date)}</p>
                      {inv.status === 'overdue' && (
                        <p className="text-xs text-red-500">{getDaysOverdue(inv.due_date)}d overdue</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant={statusVariant[inv.status] || 'secondary'}>{inv.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium mr-3">Remind</button>
                      <button className="text-xs text-gray-500 hover:text-gray-700 font-medium">PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {demoInvoices.map(inv => (
              <div key={inv.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                    <p className="text-sm text-gray-500">{inv.client?.name}</p>
                  </div>
                  <Badge variant={statusVariant[inv.status] || 'secondary'}>{inv.status}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">Due {formatDate(inv.due_date)}</p>
                  <span className="font-bold text-gray-900">{formatCurrency(inv.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
