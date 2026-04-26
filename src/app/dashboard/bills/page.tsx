import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { UploadBill } from '@/components/bills/upload-bill'
import { BillTable } from '@/components/bills/bill-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome } from '@/lib/roles'
import { getBillsForViewerSafe } from '@/lib/bills'

export default async function DashboardBillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name')

  if (!profile || (profile.role !== 'accounts' && profile.role !== 'admin')) {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  const billState = await getBillsForViewerSafe(serviceClient, user, profile)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill Approvals"
        description="Upload bills for admin approval, track status, and download the stamped copy."
      />
      {billState.unavailable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill approval workflow not ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>{billState.reason || 'The bill approval module is unavailable right now.'}</p>
            <p>Once the bill tables and storage bucket exist in this environment, uploads and status tracking will appear here automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <UploadBill />
          <BillTable initialBills={billState.data} />
        </>
      )}
    </div>
  )
}
