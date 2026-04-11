import { subDays, addDays, format } from 'date-fns'

const today = new Date()
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

export const demoClients = [
  { id: 'c1', business_id: 'b1', name: 'Sharma Textiles Pvt. Ltd.', email: 'accounts@sharmatextiles.in', phone: '+91 98200 11234', gstin: '27AABCS1429B1ZB', city: 'Mumbai', state: 'Maharashtra', contact_person: 'Mr. Rajesh Sharma', risk_label: 'good', avg_delay_days: 3, total_invoices: 12, delayed_invoices: 1, created_at: fmt(subDays(today, 180)) },
  { id: 'c2', business_id: 'b1', name: 'Krishna Exports', email: 'billing@krishnaexports.com', phone: '+91 99800 55678', gstin: '29AACCV3456D1ZC', city: 'Bengaluru', state: 'Karnataka', contact_person: 'Ms. Priya Nair', risk_label: 'moderate', avg_delay_days: 18, total_invoices: 8, delayed_invoices: 4, created_at: fmt(subDays(today, 120)) },
  { id: 'c3', business_id: 'b1', name: 'Gupta & Sons Trading Co.', email: 'finance@guptatrading.in', phone: '+91 97770 99001', gstin: '09AADCG5678F1ZA', city: 'Lucknow', state: 'Uttar Pradesh', contact_person: 'Mr. Arvind Gupta', risk_label: 'risky', avg_delay_days: 47, total_invoices: 6, delayed_invoices: 5, created_at: fmt(subDays(today, 90)) },
  { id: 'c4', business_id: 'b1', name: 'Mehta Pharma Distributors', email: 'mehta@pharma.in', phone: '+91 96660 44321', gstin: '24AABCM7890G1ZE', city: 'Ahmedabad', state: 'Gujarat', contact_person: 'Mr. Suresh Mehta', risk_label: 'good', avg_delay_days: 0, total_invoices: 15, delayed_invoices: 0, created_at: fmt(subDays(today, 240)) },
  { id: 'c5', business_id: 'b1', name: 'Verma Construction Ltd.', email: 'accounts@vermaconstruction.com', phone: '+91 94450 12345', gstin: '07AABCV2345H1ZD', city: 'Delhi', state: 'Delhi', contact_person: 'Ms. Anjali Verma', risk_label: 'moderate', avg_delay_days: 22, total_invoices: 9, delayed_invoices: 4, created_at: fmt(subDays(today, 150)) },
]

export const demoInvoices = [
  // Overdue - 52 days
  { id: 'i1', business_id: 'b1', client_id: 'c3', invoice_number: 'INV-2024-0041', amount: 185000, tax_amount: 33300, total_amount: 218300, due_date: fmt(subDays(today, 52)), issue_date: fmt(subDays(today, 82)), status: 'overdue', description: 'Wholesale goods supply — Oct batch', reminder_count: 3, last_reminder_at: fmt(subDays(today, 7)), paid_at: null, paid_amount: null, client: demoClients[2] },
  // Overdue - 18 days
  { id: 'i2', business_id: 'b1', client_id: 'c2', invoice_number: 'INV-2024-0048', amount: 95000, tax_amount: 17100, total_amount: 112100, due_date: fmt(subDays(today, 18)), issue_date: fmt(subDays(today, 48)), status: 'overdue', description: 'Export documentation services', reminder_count: 2, last_reminder_at: fmt(subDays(today, 3)), paid_at: null, paid_amount: null, client: demoClients[1] },
  // Overdue - 7 days
  { id: 'i3', business_id: 'b1', client_id: 'c5', invoice_number: 'INV-2024-0051', amount: 320000, tax_amount: 57600, total_amount: 377600, due_date: fmt(subDays(today, 7)), issue_date: fmt(subDays(today, 37)), status: 'overdue', description: 'Civil construction materials Q4', reminder_count: 1, last_reminder_at: fmt(subDays(today, 1)), paid_at: null, paid_amount: null, client: demoClients[4] },
  // Sent (due in 10 days)
  { id: 'i4', business_id: 'b1', client_id: 'c1', invoice_number: 'INV-2024-0055', amount: 75000, tax_amount: 13500, total_amount: 88500, due_date: fmt(addDays(today, 10)), issue_date: fmt(subDays(today, 20)), status: 'sent', description: 'Premium fabric supply Nov', reminder_count: 1, last_reminder_at: fmt(subDays(today, 20)), paid_at: null, paid_amount: null, client: demoClients[0] },
  // Sent (due in 22 days)
  { id: 'i5', business_id: 'b1', client_id: 'c4', invoice_number: 'INV-2024-0057', amount: 142000, tax_amount: 25560, total_amount: 167560, due_date: fmt(addDays(today, 22)), issue_date: fmt(subDays(today, 8)), status: 'sent', description: 'Pharma cold chain logistics', reminder_count: 0, last_reminder_at: null, paid_at: null, paid_amount: null, client: demoClients[3] },
  // Paid last month
  { id: 'i6', business_id: 'b1', client_id: 'c1', invoice_number: 'INV-2024-0038', amount: 120000, tax_amount: 21600, total_amount: 141600, due_date: fmt(subDays(today, 45)), issue_date: fmt(subDays(today, 75)), status: 'paid', description: 'Fabric supply — Sep batch', reminder_count: 1, last_reminder_at: null, paid_at: fmt(subDays(today, 42)), paid_amount: 141600, client: demoClients[0] },
  { id: 'i7', business_id: 'b1', client_id: 'c4', invoice_number: 'INV-2024-0039', amount: 200000, tax_amount: 36000, total_amount: 236000, due_date: fmt(subDays(today, 38)), issue_date: fmt(subDays(today, 68)), status: 'paid', description: 'Pharma distribution Oct', reminder_count: 0, last_reminder_at: null, paid_at: fmt(subDays(today, 36)), paid_amount: 236000, client: demoClients[3] },
  { id: 'i8', business_id: 'b1', client_id: 'c2', invoice_number: 'INV-2024-0042', amount: 55000, tax_amount: 9900, total_amount: 64900, due_date: fmt(subDays(today, 30)), issue_date: fmt(subDays(today, 60)), status: 'paid', description: 'Export compliance filing', reminder_count: 2, last_reminder_at: null, paid_at: fmt(subDays(today, 25)), paid_amount: 64900, client: demoClients[1] },
]

export const demoPayments = [
  { id: 'p1', invoice_id: 'i8', business_id: 'b1', amount: 64900, payment_date: fmt(subDays(today, 25)), payment_method: 'upi', reference: 'UPI/TXN/2024102845', invoice: { invoice_number: 'INV-2024-0042', client: { name: 'Krishna Exports' } } },
  { id: 'p2', invoice_id: 'i7', business_id: 'b1', amount: 236000, payment_date: fmt(subDays(today, 36)), payment_method: 'neft', reference: 'NEFT20241018GUJ001', invoice: { invoice_number: 'INV-2024-0039', client: { name: 'Mehta Pharma Distributors' } } },
  { id: 'p3', invoice_id: 'i6', business_id: 'b1', amount: 141600, payment_date: fmt(subDays(today, 42)), payment_method: 'cheque', reference: 'CHQ-00451', invoice: { invoice_number: 'INV-2024-0038', client: { name: 'Sharma Textiles Pvt. Ltd.' } } },
]

export const demoReminders = [
  { id: 'r1', invoice_id: 'i1', business_id: 'b1', type: 'legal', channel: 'both', status: 'sent', sent_at: fmt(subDays(today, 7)), message: 'Legal escalation sent' },
  { id: 'r2', invoice_id: 'i2', business_id: 'b1', type: 'firm', channel: 'whatsapp', status: 'sent', sent_at: fmt(subDays(today, 3)), message: 'Firm reminder sent' },
  { id: 'r3', invoice_id: 'i3', business_id: 'b1', type: 'friendly', channel: 'email', status: 'sent', sent_at: fmt(subDays(today, 1)), message: 'Friendly reminder sent' },
]

export const demoBusiness = {
  id: 'b1', user_id: 'u1',
  name: 'TechSoft Solutions Pvt. Ltd.',
  gstin: '27AABCT1234A1ZS',
  phone: '+91 98100 77654',
  email: 'billing@techsoftsolutions.in',
  address: '401, Prestige Tower, MG Road',
  city: 'Pune', state: 'Maharashtra', pincode: '411001',
}
