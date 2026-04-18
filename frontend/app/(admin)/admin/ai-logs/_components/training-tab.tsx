"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Cell,
} from "recharts";
import { Download } from "lucide-react";

interface TrainingStats {
  totalSnapshots: number;
  totalInteractions: number;
  snapshotsWithInteraction: number;
  coverageRate: number;
  byAction: Record<string, number>;
  byModelVersion: Record<string, number>;
}

interface TrainingRow {
  snapshotId: string;
  matchId: string;
  demandId: string;
  listingId: string;
  textScore: number;
  finalScore: number;
  label: number | null;
  interactionCount: number;
  rankPosition: number;
  modelVersion: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  ordered:      "#10B981",
  offered:      "#3B82F6",
  messaged:     "#8B5CF6",
  accepted:     "#F59E0B",
  detail_viewed:"#6B7280",
  impressed:    "#D1D5DB",
  dismissed:    "#EF4444",
};

const ACTION_LABEL_SCORES: Record<string, number> = {
  ordered: 1.0, offered: 0.9, messaged: 0.7,
  accepted: 0.5, detail_viewed: 0.3, impressed: 0.2, dismissed: 0.0,
};

export default function TrainingTab() {
  const [stats,   setStats]   = useState<TrainingStats | null>(null);
  const [rows,    setRows]    = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, dataRes] = await Promise.all([
        fetch("/api/proxy/ai/training-data/stats"),
        fetch("/api/proxy/ai/training-data?limit=200"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (dataRes.ok) {
        const data = await dataRes.json();
        setRows(data.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/proxy/ai/training-data/export");
      const data = await res.json();
      const jsonl = data.rows.map((r: unknown) => JSON.stringify(r)).join("\n");
      const blob = new Blob([jsonl], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `training_data_${new Date().toISOString().split("T")[0]}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Bar chart: user actions distribution
  const actionChartData = stats
    ? Object.entries(stats.byAction)
        .map(([action, count]) => ({
          action,
          count,
          label: ACTION_LABEL_SCORES[action] ?? 0,
          fill: ACTION_COLORS[action] ?? "#6B7280",
        }))
        .sort((a, b) => b.label - a.label)
    : [];

  // Scatter: split into positive (label >= 0.5) and negative (label < 0.5)
  const labeledRows = rows.filter((r) => r.label !== null);
  const scatterPositive = labeledRows
    .filter((r) => (r.label ?? 0) >= 0.5)
    .map((r) => ({ x: +(r.finalScore ?? 0).toFixed(2), y: +(r.label ?? 0).toFixed(2) }));
  const scatterNegative = labeledRows
    .filter((r) => (r.label ?? 0) < 0.5)
    .map((r) => ({ x: +(r.finalScore ?? 0).toFixed(2), y: +(r.label ?? 0).toFixed(2) }));

  // Histogram bins: matchScore distribution grouped
  const scoreBins = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${(i + 1) * 10}`,
    count: rows.filter((r) => {
      const s = (r.finalScore ?? 0) * 100;
      return s >= i * 10 && s < (i + 1) * 10;
    }).length,
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Snapshots",     value: stats.totalSnapshots,           color: "bg-blue-500" },
            { label: "Total Interactions",  value: stats.totalInteractions,        color: "bg-green-500" },
            { label: "Labeled Snapshots",   value: stats.snapshotsWithInteraction, color: "bg-purple-500" },
            { label: "Coverage Rate",       value: `${Math.round(stats.coverageRate * 100)}%`, color: "bg-orange-500" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-2 h-12 rounded-full ${c.color}`} />
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: User actions distribution */}
        {actionChartData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">User Feedback Distribution</h3>
            <p className="text-xs text-gray-400 mb-3">Number of interactions per action type</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={actionChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="action" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, _name, entry) => [
                    `${value} interactions (label: ${(entry.payload as typeof actionChartData[number]).label})`,
                    (entry.payload as typeof actionChartData[number]).action,
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {actionChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 2: AI Score vs. User Label scatter — color-coded by outcome */}
        {labeledRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">AI Score vs. User Feedback</h3>
            <p className="text-xs text-gray-400 mb-1">
              X = AI final score · Y = interaction label · Ideal: diagonal cluster
            </p>
            <div className="flex items-center gap-4 mb-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
                Positive (≥ 0.5)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block" />
                Negative (&lt; 0.5)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 0, right: 10, left: -20, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="AI Score"
                  domain={[0, 1]}
                  tick={{ fontSize: 11 }}
                  label={{ value: "AI Score", position: "insideBottom", offset: -8, fontSize: 11 }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="User Label"
                  domain={[0, 1]}
                  tick={{ fontSize: 11 }}
                  label={{ value: "Label", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value) => [value != null ? (+value).toFixed(2) : "—"]}
                />
                <Scatter name="Positive" data={scatterPositive} fill="#10B981" fillOpacity={0.7} />
                <Scatter name="Negative" data={scatterNegative} fill="#EF4444" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 3: Final score histogram */}
        {rows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">AI Score Distribution</h3>
            <p className="text-xs text-gray-400 mb-3">Distribution of final match scores (0–100)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreBins} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} matches`, "Count"]} />
                <Bar dataKey="count" fill="#6366F1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Coverage & model versions */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Coverage Progress</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Labeled: {stats.snapshotsWithInteraction}</span>
                  <span>Total: {stats.totalSnapshots}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.round(stats.coverageRate * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {Math.round(stats.coverageRate * 100)}% of matches have user feedback
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Model Versions</h3>
              <div className="space-y-1">
                {Object.entries(stats.byModelVersion).map(([version, count]) => (
                  <div key={version} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{version}</span>
                    <span className="font-semibold text-gray-900">{count} snapshots</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {rows.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400 text-sm">No training data yet.</p>
          <p className="text-gray-400 text-xs mt-1">Training data accumulates as users interact with AI-generated matches.</p>
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting || (stats?.totalSnapshots ?? 0) === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting…" : `Export JSONL (${stats?.totalSnapshots ?? 0} rows)`}
        </button>
      </div>
    </div>
  );
}
