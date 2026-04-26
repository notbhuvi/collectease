import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { AdminBillReview } from '@/components/bills/admin-bill-review'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome } from '@/lib/roles'
import { getBillsForViewerSafe } from '@/lib/bills'

export default async function AdminBillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name')

  if (!profile || profile.role !== 'admin') {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  const billState = await getBillsForViewerSafe(serviceClient, user, profile, { status: 'pending' })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill Reviews"
        description="Review pending finance uploads and stamp them as approved or declined."
      />
      {billState.unavailable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill approval workflow not ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>{billState.reason || 'The bill approval module is unavailable right now.'}</p>
            <p>The admin area stays usable, but the bill tables and storage setup need to be present before reviews can open here.</p>
          </CardContent>
        </Card>
      ) : (
        <AdminBillReview initialBills={billState.data} />
      )}
    </div>
  )
}
