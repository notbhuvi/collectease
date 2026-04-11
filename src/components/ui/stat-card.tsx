import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  className?: string
  valueClassName?: string
}

export function StatCard({ title, value, subtitle, icon, trend, className, valueClassName }: StatCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={cn('mt-2 text-2xl font-bold text-gray-900', valueClassName)}>{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
          {trend && (
            <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
