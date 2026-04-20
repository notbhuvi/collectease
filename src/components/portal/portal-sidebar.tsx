'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Package, LayoutDashboard, FileText, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const navItems = [
  { href: '/portal', label: 'Open Loads', icon: LayoutDashboard },
  { href: '/portal/bids', label: 'My Bids', icon: FileText },
]

export function PortalSidebar({ userName, companyName }: { userName?: string; companyName?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{companyName || 'Transporter'}</p>
          {userName && <p className="text-xs text-gray-400 truncate max-w-[120px]">{userName}</p>}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/portal' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-emerald-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-gray-500">Logged in as</p>
          <p className="text-xs font-medium text-gray-700 truncate">{userName}</p>
        </div>
        <button onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 text-gray-400" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-56 shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0">
        <SidebarContent />
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-bold text-gray-900">{companyName || 'Portal'}</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600"><Menu className="h-5 w-5" /></button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 text-gray-400"><X className="h-5 w-5" /></button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
