// ── Role system ───────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'accounts' | 'transport_team' | 'transporter'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  company_name: string | null
  created_at: string
}

// ── Transport ─────────────────────────────────────────────────────────────────
export type LoadStatus = 'open' | 'closed' | 'awarded' | 'completed'

export interface TransportLoad {
  id: string
  created_by: string
  pickup_location: string
  drop_location: string
  material: string
  weight: string
  vehicle_type: string
  pickup_date: string
  bidding_deadline: string
  status: LoadStatus
  notes: string | null
  created_at: string
  // joined
  creator?: { full_name: string | null; email: string }
  bids?: TransportBid[]
  awarded?: AwardedLoad
}

export interface TransportBid {
  id: string
  load_id: string
  transporter_id: string
  bid_amount: number
  remarks: string | null
  created_at: string
  updated_at: string
  // joined
  transporter?: { full_name: string | null; company_name: string | null; email: string }
}

export interface AwardedLoad {
  id: string
  load_id: string
  transporter_id: string
  final_amount: number
  awarded_by: string | null
  awarded_at: string
  // joined
  transporter?: { full_name: string | null; company_name: string | null }
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type RiskLabel = 'good' | 'moderate' | 'risky'
export type ReminderType = 'friendly' | 'firm' | 'final_warning' | 'legal'
export type ReminderChannel = 'email' | 'whatsapp' | 'both'

export interface Business {
  id: string
  user_id: string
  name: string
  gstin: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  logo_url: string | null
  created_at: string
}

export interface Client {
  id: string
  business_id: string
  name: string
  email: string | null
  phone: string | null
  gstin: string | null
  address: string | null
  city: string | null
  state: string | null
  contact_person: string | null
  risk_label: RiskLabel
  avg_delay_days: number
  total_invoices: number
  delayed_invoices: number
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  business_id: string
  client_id: string
  invoice_number: string
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  issue_date: string
  status: InvoiceStatus
  description: string | null
  notes: string | null
  reminder_count: number
  last_reminder_at: string | null
  reminder_initial_delay: number
  reminder_interval_days: number
  paid_at: string | null
  paid_amount: number | null
  created_at: string
  updated_at: string
  // joined
  client?: Client
}

export interface Reminder {
  id: string
  invoice_id: string
  business_id: string
  type: ReminderType
  channel: ReminderChannel
  message: string
  sent_at: string
  status: 'sent' | 'failed' | 'pending'
  error: string | null
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  business_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
}

export interface EscalationLog {
  id: string
  invoice_id: string
  business_id: string
  type: 'formal_reminder' | 'legal_notice' | 'msme_complaint'
  document_url: string | null
  created_at: string
}

export interface DashboardStats {
  total_receivables: number
  overdue_amount: number
  paid_this_month: number
  total_clients: number
  aging: {
    bucket_0_30: number
    bucket_30_60: number
    bucket_60_90: number
    bucket_90_plus: number
  }
  monthly_collection: Array<{ month: string; collected: number; invoiced: number }>
}
