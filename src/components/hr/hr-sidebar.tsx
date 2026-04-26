'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Briefcase,
  CalendarCheck2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const sections = [
  {
    title: '',
    items: [{ href: '/hr', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Workforce',
    items: [
      { href: '/hr/employees', label: 'Employees', icon: Users },
      { href: '/hr/attendance', label: 'Attendance', icon: CalendarCheck2 },
      { href: '/hr/leaves', label: 'Leave Management', icon: Briefcase },
      { href: '/hr/documents', label: 'Documents', icon: FileText },
      { href: '/hr/payroll', label: 'Payroll', icon: CreditCard },
    ],
  },
  {
    title: '',
    items: [{ href: '/hr/settings', label: 'Settings', icon: Settings }],
  },
]

export function HrSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">HR Portal</p>
            <p className="text-xs text-gray-400">{userName || 'CollectEase'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map(section => (
          <div key={section.title || section.items[0].href} className="mb-4 last:mb-0">
            {section.title && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/hr' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-rose-50 text-rose-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-rose-600' : 'text-gray-400')} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 text-gray-400" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 border-r border-gray-200 lg:flex lg:flex-col">
        {content}
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-rose-600" />
          <span className="text-sm font-bold text-gray-900">HR Portal</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-72 shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4 z-10 rounded-md p-1 text-gray-400">
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
