"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TablePagination from "@/components/table-pagination";

interface MatchLog {
  id: string;
  triggeredBy: string;
  sourceId: string;
  candidateCount: number;
  matchesCreated: number;
  createdAt: string;
}

export default function MatchLogsTab() {
  const [logs,    setLogs]    = useState<MatchLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");
  const [offset,  setOffset]  = useState(0);
  const limit = 20;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filter) params.set("triggeredBy", filter);
    try {
      const res = await fetch(`/api/proxy/ai/match-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 30_000);
    return () => clearInterval(interval);
  }, [fetch_]);

  const conversionRate = (log: MatchLog) =>
    log.candidateCount > 0
      ? ((log.matchesCreated / log.candidateCount) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-3">
        {["", "demand", "listing"].map((v) => (
          <button
            key={v}
            onClick={() => { setFilter(v); setOffset(0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === v
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Triggered By", "Source ID", "Candidates", "Matches Created", "Conversion", "Time"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">No match logs yet</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.triggeredBy === "demand"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {log.triggeredBy}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-500">
                        {log.sourceId.slice(0, 12)}…
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{log.candidateCount}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${log.matchesCreated > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {log.matchesCreated}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, parseFloat(conversionRate(log)))}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{conversionRate(log)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination total={total} limit={limit} offset={offset} onPageChange={setOffset} />
        </>
      )}
    </div>
  );
}
