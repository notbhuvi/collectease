import { Sidebar } from '@/components/layout/sidebar'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar businessName="TechSoft Solutions Pvt. Ltd." />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="pt-14 lg:pt-0">
          <div className="p-6 max-w-7xl mx-auto">
            {/* Demo banner */}
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
              <span className="font-semibold">DEMO MODE</span> — Sample data. Connect Supabase in <code className="bg-amber-100 px-1 rounded">.env.local</code> to use real data.
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
