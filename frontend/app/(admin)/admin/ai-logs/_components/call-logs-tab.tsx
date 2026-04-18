"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import TablePagination from "@/components/table-pagination";
import LatencyBadge from "./latency-badge";

interface CallLog {
  id: string;
  endpoint: string;
  latencyMs?: number;
  error?: string;
  createdAt: string;
}

interface CallLogDetail extends CallLog {
  inputData: unknown;
  outputData: unknown;
}

const ENDPOINTS = [
  "/score-pairs", "/vision/extract", "/vision/filter",
  "/vision/score", "/vision/listing-context",
  "/stage0/parse", "/stage0/keywords", "/search",
];

function LogRow({ log }: { log: CallLog }) {
  const [open,   setOpen]   = useState(false);
  const [detail, setDetail] = useState<CallLogDetail | null>(null);

  const loadDetail = async () => {
    if (detail) { setOpen((o) => !o); return; }
    const res = await fetch(`/api/proxy/ai/call-logs/${log.id}`);
    setDetail(await res.json());
    setOpen(true);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={loadDetail}>
        <td className="px-4 py-3">
          {open
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{log.endpoint}</span>
        </td>
        <td className="px-4 py-3"><LatencyBadge ms={log.latencyMs} /></td>
        <td className="px-4 py-3">
          {log.error
            ? <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">{log.error.slice(0, 60)}</span>
            : <span className="text-xs text-green-600">OK</span>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
      </tr>
      {open && detail && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">INPUT</p>
                <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(detail.inputData, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">OUTPUT</p>
                <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(detail.outputData, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CallLogsTab() {
  const [logs,    setLogs]    = useState<CallLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [endpoint, setEndpoint] = useState("");
  const [offset,  setOffset]  = useState(0);
  const limit = 20;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (endpoint) params.set("endpoint", endpoint);
    try {
      const res = await fetch(`/api/proxy/ai/call-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [endpoint, offset]);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 30_000);
    return () => clearInterval(interval);
  }, [fetch_]);

  return (
    <div className="space-y-4">
      {/* Endpoint filter chips */}
      <div className="flex flex-wrap gap-2">
        {["", ...ENDPOINTS].map((ep) => (
          <button
            key={ep}
            onClick={() => { setEndpoint(ep); setOffset(0); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              endpoint === ep
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {ep || "All"}
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
                  <th className="w-8 px-4 py-3" />
                  {["Endpoint", "Latency", "Status", "Time"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">No call logs yet</td></tr>
                ) : logs.map((log) => <LogRow key={log.id} log={log} />)}
              </tbody>
            </table>
          </div>
          <TablePagination total={total} limit={limit} offset={offset} onPageChange={setOffset} />
        </>
      )}
    </div>
  );
}
