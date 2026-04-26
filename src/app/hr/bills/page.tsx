import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { UploadBill } from '@/components/bills/upload-bill'
import { BillTable } from '@/components/bills/bill-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome } from '@/lib/roles'
import { getBillsForViewerSafe } from '@/lib/bills'

export default async function HrBillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name')

  if (!profile || (profile.role !== 'hr' && profile.role !== 'admin')) {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  const billState = await getBillsForViewerSafe(serviceClient, user, profile)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        description="Upload bills received by HR and track what reaches admin review and then finance."
      />
      {billState.unavailable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill approval workflow not ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>{billState.reason || 'The bill approval module is unavailable right now.'}</p>
            <p>Once the bill tables and storage bucket exist in this environment, HR uploads and admin review will appear here automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <UploadBill
            title="Upload HR Bill"
            description="Upload bills HR receives by email so admin can approve or decline them before finance sees anything."
          />
          <BillTable initialBills={billState.data} mode="hr" />
        </>
      )}
    </div>
  )
}
