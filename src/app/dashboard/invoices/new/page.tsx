import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { CreateInvoiceForm } from '@/components/invoices/create-invoice-form'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/auth/register')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, gstin')
    .eq('business_id', business.id)
    .order('name')

  return (
    <div>
      <PageHeader
        title="Create Invoice"
        description="Add a new invoice for your client"
      />
      <CreateInvoiceForm businessId={business.id} clients={clients || []} />
    </div>
  )
}
