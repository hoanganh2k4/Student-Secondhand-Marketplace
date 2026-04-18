"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Search,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
} from "lucide-react";

interface MarketStatResponse {
  demands: { total: number; active: number; fulfilled: number; expiringSoon: number };
  listings: { total: number; active: number; removed: number; lowProofScore: number };
  orders: { total: number; completed: number; disputed: number; inProgress: number; totalVolume: number };
  matches: { total: number; conversionRate: number };
}

const COLORS = {
  blue:   "#3B82F6",
  green:  "#10B981",
  yellow: "#F59E0B",
  red:    "#EF4444",
  gray:   "#6B7280",
  purple: "#8B5CF6",
};

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function DonutChart({ data, title }: {
  data: { name: string; value: number; color: string }[];
  title: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConversionGauge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 30 ? COLORS.green : pct >= 15 ? COLORS.yellow : COLORS.red;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Match → Order Conversion Rate</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E5E7EB" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="14" fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${(pct / 100) * 87.96} 87.96`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{pct}%</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            {pct >= 30 ? "Excellent conversion" : pct >= 15 ? "Moderate conversion" : "Low conversion"}
          </p>
          <p className="text-xs text-gray-400">of matches result in completed orders</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceStat() {
  const [stats, setStats] = useState<MarketStatResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/admin/stats");
      if (!res.ok) return;
      setStats(await res.json());
    } catch {
      // silent — stats are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 mb-10">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const demandOther = stats.demands.total - stats.demands.active - stats.demands.fulfilled - stats.demands.expiringSoon;
  const listingOther = stats.listings.total - stats.listings.active - stats.listings.removed - stats.listings.lowProofScore;
  const orderOther = stats.orders.total - stats.orders.completed - stats.orders.disputed - stats.orders.inProgress;

  return (
    <div className="mb-10 space-y-8">
      {/* Top KPI row */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Marketplace Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Demands"  value={stats.demands.total}  icon={Search}      color="bg-blue-500" />
          <StatCard title="Total Listings" value={stats.listings.total} icon={Package}     color="bg-indigo-500" />
          <StatCard title="Total Orders"   value={stats.orders.total}   icon={ShoppingBag} color="bg-green-500" />
          <StatCard
            title="Total Volume"
            value={`${(stats.orders.totalVolume / 1_000_000).toFixed(1)}M ₫`}
            icon={DollarSign}
            color="bg-emerald-500"
            subtitle="completed orders"
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DonutChart
          title="Demand Status"
          data={[
            { name: "Active",        value: stats.demands.active,       color: COLORS.green },
            { name: "Fulfilled",     value: stats.demands.fulfilled,    color: COLORS.blue },
            { name: "Expiring Soon", value: stats.demands.expiringSoon, color: COLORS.yellow },
            { name: "Other",         value: Math.max(0, demandOther),   color: COLORS.gray },
          ].filter((d) => d.value > 0)}
        />
        <DonutChart
          title="Listing Status"
          data={[
            { name: "Active",          value: stats.listings.active,         color: COLORS.green },
            { name: "Low Proof Score", value: stats.listings.lowProofScore,  color: COLORS.yellow },
            { name: "Removed",         value: stats.listings.removed,        color: COLORS.red },
            { name: "Other",           value: Math.max(0, listingOther),     color: COLORS.gray },
          ].filter((d) => d.value > 0)}
        />
        <DonutChart
          title="Order Status"
          data={[
            { name: "Completed",  value: stats.orders.completed,  color: COLORS.green },
            { name: "In Progress", value: stats.orders.inProgress, color: COLORS.blue },
            { name: "Disputed",   value: stats.orders.disputed,   color: COLORS.red },
            { name: "Other",      value: Math.max(0, orderOther), color: COLORS.gray },
          ].filter((d) => d.value > 0)}
        />
        <ConversionGauge rate={stats.matches.conversionRate} />
      </div>

      {/* Alert row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Expiring Demands"
          value={stats.demands.expiringSoon}
          icon={Clock}
          color="bg-yellow-500"
          subtitle="expiring soon"
        />
        <StatCard
          title="Active Disputes"
          value={stats.orders.disputed}
          icon={AlertTriangle}
          color="bg-red-500"
          subtitle="need resolution"
        />
        <StatCard
          title="Total Matches"
          value={stats.matches.total}
          icon={Zap}
          color="bg-purple-500"
          subtitle={`${Math.round(stats.matches.conversionRate * 100)}% conversion`}
        />
      </div>
    </div>
  );
}
