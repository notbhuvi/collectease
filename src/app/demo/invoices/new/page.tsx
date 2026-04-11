import { PageHeader } from '@/components/layout/page-header'
import { CreateInvoiceForm } from '@/components/invoices/create-invoice-form'
import { demoClients } from '@/lib/demo-data'

export default function DemoNewInvoicePage() {
  return (
    <div>
      <PageHeader title="Create Invoice" description="Add a new invoice for your client" />
      <CreateInvoiceForm businessId="b1" clients={demoClients as any} />
    </div>
  )
}
