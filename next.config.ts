import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // jsPDF runs only on server-side routes, mark as external for edge compatibility
  serverExternalPackages: ['jspdf', 'jspdf-autotable'],
  experimental: {},
}

export default nextConfig
