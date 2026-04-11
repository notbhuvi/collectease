import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { Plus, FileText, Search, Filter } from 'lucide-react'
import { InvoiceActions } from '@/components/invoices/invoice-actions'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/auth/register')

  const params = await searchParams
  const filter = params.filter || 'all'
  const search = params.search || ''

  let query = supabase
    .from('invoices')
    .select('*, client:clients(id, name, phone, email)')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (filter === 'overdue') query = query.eq('status', 'overdue')
  else if (filter === 'paid') query = query.eq('status', 'paid')
  else if (filter === 'sent') query = query.eq('status', 'sent')
  else if (filter === 'draft') query = query.eq('status', 'draft')

  const { data: invoices } = await query

  const filtered = (invoices || []).filter(inv => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(s) ||
      inv.client?.name?.toLowerCase().includes(s)
    )
  })

  const statusVariant: Record<string, 'default' | 'success' | 'destructive' | 'secondary' | 'warning'> = {
    draft: 'secondary',
    sent: 'default',
    paid: 'success',
    overdue: 'destructive',
    cancelled: 'secondary',
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Manage and track all your invoices"
        actions={
          <Link href="/dashboard/invoices/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        }
      />

      <InvoiceFilters currentFilter={filter} />

      {/* Invoice table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900">No invoices found</p>
              <p className="text-xs text-gray-500 mt-1">Create your first invoice to get started</p>
              <Link href="/dashboard/invoices/new" className="mt-4">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
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
                    {filtered.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                          {inv.description && <p className="text-xs text-gray-400 truncate max-w-[160px]">{inv.description}</p>}
                        </td>
                        <td className="px-4 py-4 text-gray-700">{inv.client?.name || '–'}</td>
                        <td className="px-4 py-4">
                          <p className="text-gray-700">{formatDate(inv.due_date)}</p>
                          {inv.status === 'overdue' && (
                            <p className="text-xs text-red-500">{getDaysOverdue(inv.due_date)}d overdue</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant={statusVariant[inv.status] || 'secondary'}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <InvoiceActions invoice={inv} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map(inv => (
                  <div key={inv.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-500">{inv.client?.name || '–'}</p>
                      </div>
                      <Badge variant={statusVariant[inv.status] || 'secondary'}>{inv.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400">Due {formatDate(inv.due_date)}</p>
                        {inv.status === 'overdue' && (
                          <p className="text-xs text-red-500">{getDaysOverdue(inv.due_date)}d overdue</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">{formatCurrency(inv.total_amount)}</span>
                        <InvoiceActions invoice={inv} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
