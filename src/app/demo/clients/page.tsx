import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { demoClients, demoInvoices } from '@/lib/demo-data'

const riskVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  good: 'success', moderate: 'warning', risky: 'destructive',
}

export default function DemoClientsPage() {
  const outstandingMap: Record<string, number> = {}
  demoInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').forEach(inv => {
    outstandingMap[inv.client_id] = (outstandingMap[inv.client_id] || 0) + inv.total_amount
  })

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your clients and track payment behavior"
        actions={<Button><Plus className="h-4 w-4" />Add Client</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Outstanding</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Invoices</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Avg Delay</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {demoClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-400">GSTIN: {client.gstin}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">{client.contact_person}</p>
                      <p className="text-xs text-gray-400">{client.email}</p>
                      <p className="text-xs text-gray-400">{client.phone}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold ${(outstandingMap[client.id] || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(outstandingMap[client.id] || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600">{client.total_invoices}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={client.avg_delay_days > 0 ? 'text-orange-600' : 'text-gray-400'}>
                        {client.avg_delay_days > 0 ? `${client.avg_delay_days}d` : '–'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={riskVariant[client.risk_label] || 'secondary'}>{client.risk_label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {demoClients.map(client => (
              <div key={client.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-400">{client.email}</p>
                  </div>
                  <Badge variant={riskVariant[client.risk_label] || 'secondary'}>{client.risk_label}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{client.total_invoices} invoices · {client.avg_delay_days > 0 ? `${client.avg_delay_days}d avg delay` : 'on time'}</span>
                  <span className={`font-semibold ${(outstandingMap[client.id] || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatCurrency(outstandingMap[client.id] || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
