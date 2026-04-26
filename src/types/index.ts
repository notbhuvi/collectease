// ── Role system ───────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'accounts' | 'transport_team' | 'transporter' | 'plant_ops' | 'hr'

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
  quantity_value?: number | null
  quantity_unit?: string | null
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
  total_amount?: number | null
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

export type BillApprovalStatus = 'pending' | 'approved' | 'declined'

export interface BillApproval {
  id: string
  uploaded_by: string | null
  file_url: string | null
  file_type: string | null
  original_name: string | null
  status: BillApprovalStatus
  admin_id: string | null
  admin_remark: string | null
  stamped_file_url: string | null
  created_at: string
  decided_at: string | null
  downloaded_at: string | null
  delete_after_at: string | null
}

export interface BillLog {
  id: string
  bill_id: string | null
  uploaded_by: string | null
  status: BillApprovalStatus | null
  remark: string | null
  action_by: string | null
  created_at: string
}

// ── HR Portal ────────────────────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave'
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'remote'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface Employee {
  id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  department: string | null
  designation: string | null
  joining_date: string | null
  salary: number | null
  status: EmployeeStatus
  created_at: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  biometric_ref: string | null
  created_at: string
  employee?: Pick<Employee, 'id' | 'name' | 'department' | 'designation'>
}

export interface LeaveRecord {
  id: string
  employee_id: string
  type: string
  from_date: string
  to_date: string
  status: LeaveStatus
  approved_by: string | null
  reason: string | null
  created_at: string
  employee?: Pick<Employee, 'id' | 'name' | 'department' | 'designation'>
}

export interface EmployeeDocument {
  id: string
  employee_id: string | null
  doc_type: string
  file_url: string
  expires_on: string | null
  created_at: string
  employee?: Pick<Employee, 'id' | 'name' | 'department'>
  signed_url?: string | null
}

export interface HrPolicyDocument {
  id: string
  title: string
  file_url: string
  created_by: string | null
  created_at: string
  signed_url?: string | null
}

// ── Plant & Warehouse ────────────────────────────────────────────────────────
export type ProductionShift = 'A' | 'B' | 'C' | 'General'
export type RawMaterialTxnType = 'opening' | 'inward' | 'consumed' | 'adjustment'
export type WarehouseMovementType = 'inward' | 'outward' | 'adjustment'
export type DispatchStatus = 'pending' | 'completed' | 'cancelled'

export interface PlantProductionLog {
  id: string
  date: string
  shift: ProductionShift
  product_name: string
  sku: string | null
  qty: number
  unit: string
  machine: string | null
  operator: string | null
  remarks: string | null
  created_by: string | null
  created_at: string
}

export interface RawMaterial {
  id: string
  material_name: string
  unit: string
  min_level: number
  created_at: string
}

export interface RawMaterialTransaction {
  id: string
  material_id: string
  date: string
  type: RawMaterialTxnType
  qty: number
  rate: number | null
  remarks: string | null
  created_at: string
}

export interface FinishedGoodsStock {
  id: string
  product_name: string
  sku: string | null
  qty: number
  updated_at: string
}

export interface FgDispatch {
  id: string
  date: string
  customer_name: string
  invoice_no: string | null
  truck_no: string | null
  destination: string | null
  product_name: string
  sku: string | null
  qty: number
  remarks: string | null
  status: DispatchStatus
}

export interface WarehouseItem {
  id: string
  item_name: string
  sku: string | null
  category: string | null
  unit: string
  opening_stock: number
  current_stock: number
  reserved_stock: number
  min_level: number
  unit_rate: number
  updated_at: string
}

export interface WarehouseMovement {
  id: string
  item_id: string
  date: string
  type: WarehouseMovementType
  qty: number
  reference_no: string | null
  remarks: string | null
}
