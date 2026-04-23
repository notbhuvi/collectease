export const TRANSPORT_QUANTITY_UNITS = ['MT', 'Package', 'PCS', 'KG'] as const

export type TransportQuantityUnit = typeof TRANSPORT_QUANTITY_UNITS[number]

export const TRANSPORT_DEPARTMENT_NAME = 'SIRPL Transport Department'
export const TRANSPORT_DEPARTMENT_EMAILS = ['jbehera@sirpl.in', 'headoffice@sirpl.in'] as const
export const TRANSPORT_DEPARTMENT_MOBILE = '+91 7735730131'

export interface LoadQuantityInput {
  quantity_value?: number | string | null
  quantity_unit?: string | null
  weight?: string | null
}

export function normalizeTransportQuantityUnit(unit?: string | null): TransportQuantityUnit {
  const normalized = (unit || '').trim().toLowerCase()
  if (normalized === 'mt') return 'MT'
  if (normalized === 'package' || normalized === 'packages') return 'Package'
  if (normalized === 'pcs' || normalized === 'pc') return 'PCS'
  if (normalized === 'kg' || normalized === 'kgs') return 'KG'
  return 'MT'
}

export function parseNumericQuantity(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function formatQuantityValue(value: number | string | null | undefined): string {
  const numericValue = parseNumericQuantity(value)
  if (numericValue === null) return ''
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toString()
}

export function extractLegacyQuantity(weight?: string | null): { quantityValue: number | null; quantityUnit: TransportQuantityUnit } {
  const trimmed = (weight || '').trim()
  if (!trimmed) return { quantityValue: null, quantityUnit: 'MT' }

  const match = trimmed.match(/^([\d.,]+)\s*([a-zA-Z]+)?$/)
  if (!match) return { quantityValue: null, quantityUnit: 'MT' }

  return {
    quantityValue: parseNumericQuantity(match[1]),
    quantityUnit: normalizeTransportQuantityUnit(match[2] || 'MT'),
  }
}

export function getLoadQuantity(load: LoadQuantityInput): { quantityValue: number | null; quantityUnit: TransportQuantityUnit } {
  const quantityValue = parseNumericQuantity(load.quantity_value)
  if (quantityValue !== null) {
    return {
      quantityValue,
      quantityUnit: normalizeTransportQuantityUnit(load.quantity_unit),
    }
  }

  return extractLegacyQuantity(load.weight)
}

export function formatLoadQuantity(load: LoadQuantityInput): string {
  const { quantityValue, quantityUnit } = getLoadQuantity(load)
  if (quantityValue === null) return (load.weight || '').trim()
  return `${formatQuantityValue(quantityValue)} ${quantityUnit}`
}

export function getBidRateLabel(unit?: string | null): string {
  return `Rs./${normalizeTransportQuantityUnit(unit)}`
}

export function calculateTransportTotalFare(
  quantityValue: number | string | null | undefined,
  rate: number | string | null | undefined
): number | null {
  const quantity = parseNumericQuantity(quantityValue)
  const bidRate = parseNumericQuantity(rate)
  if (quantity === null || bidRate === null) return null
  return quantity * bidRate
}

export interface TransportWorkOrderContext {
  refNumber: string
  date: string
  transporterName: string
  transporterEmail?: string | null
  pickup: string
  drop: string
  material: string
  quantity: string
  vehicleType: string
  rate: string
  totalFare: string
  pickupDate: string
}

export function buildTransportWorkOrderText(ctx: TransportWorkOrderContext): string {
  const recipientLine = ctx.transporterEmail
    ? `${ctx.transporterName}\nEmail: ${ctx.transporterEmail}`
    : ctx.transporterName

  return `Ref: ${ctx.refNumber}
Date: ${ctx.date}

To
${recipientLine}

Subject: Work Order for Transportation of ${ctx.material} from ${ctx.pickup} to ${ctx.drop}

Dear Sir/Madam,

With reference to your bid submitted through the SIRPL Transport Portal, we are pleased to place this work order on you for transportation of our material as per the details and terms given below.

Work Details
1. Route: ${ctx.pickup} to ${ctx.drop}
2. Material: ${ctx.material}
3. Quantity: ${ctx.quantity}
4. Vehicle Type: ${ctx.vehicleType}
5. Pickup Date: ${ctx.pickupDate}
6. Rate: ${ctx.rate}
7. Total Fare: ${ctx.totalFare}

Terms and Conditions
1. Validity of Rate:
The above rate is applicable for this awarded load unless otherwise agreed in writing by both parties.

2. Manpower:
You will arrange the required manpower for loading or unloading wherever needed at your scope unless otherwise approved by SIRPL in writing.

3. Placement of Trucks:
You shall place the required vehicle at the loading point on time as per our instruction. Any delay causing operational loss may be recovered from your account.

4. Statutory Acts and Rules:
You shall comply with all applicable statutory acts, transport rules, safety rules and government requirements during movement of the material.

5. Payment:
You shall submit your bill with the receipted challan, proof of delivery and supporting documents for payment processing.

6. Billing Quantity:
Billing will be considered on the actual dispatched and accepted quantity for this load. The awarded rate is ${ctx.rate}.

7. Delivery of Invoice Quantity:
You will be responsible for safe and complete delivery of the awarded quantity to the destination. Any shortage or damage may be recovered from your bill.

8. TDS:
TDS will be deducted as per applicable government rules.

9. Taxes:
Applicable taxes will be handled as per statutory provisions and the supporting registration details provided by you.

10. Special Note:
You will be responsible for damage, shortage or loss of material from loading point to unloading point during transit.

We reserve the right to cancel this work order in case of non-performance or failure to comply with the above terms.

Please acknowledge and confirm acceptance of this work order.

Yours faithfully,
${TRANSPORT_DEPARTMENT_NAME}
Email: ${TRANSPORT_DEPARTMENT_EMAILS.join(' / ')}
Mobile: ${TRANSPORT_DEPARTMENT_MOBILE}`
}
