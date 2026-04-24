import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { CreateInvoiceForm } from '@/components/invoices/create-invoice-form'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) redirect('/dashboard/settings')

  const { data: clients } = await serviceClient
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
