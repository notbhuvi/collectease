import { redirect } from 'next/navigation'

// /transport/loads just redirects to the main transport page which has the full loads table
export default function LoadsPage() {
  redirect('/transport')
}
