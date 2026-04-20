import { redirect } from 'next/navigation'

// Registration is disabled — this app is for internal use only
export default function RegisterPage() {
  redirect('/auth/login')
}
