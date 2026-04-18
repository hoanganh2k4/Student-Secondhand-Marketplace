"use client";

import { useState } from "react";
import { Zap, Phone, Database, BarChart2 } from "lucide-react";
import MatchLogsTab from "./_components/match-logs-tab";
import CallLogsTab  from "./_components/call-logs-tab";
import TrainingTab  from "./_components/training-tab";

const TABS = [
  { key: "match-logs",     label: "Match Runs",    icon: Zap },
  { key: "call-logs",      label: "Call Logs",     icon: Phone },
  { key: "training-data",  label: "Training Data", icon: BarChart2 },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminAiLogsPage() {
  const [active, setActive] = useState<TabKey>("match-logs");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Database className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">AI Monitoring</h1>
          </div>
          <p className="text-sm text-gray-500">
            Inspect every AI call, matching run, and training signal — export data for model retraining
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-6 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {active === "match-logs"    && <MatchLogsTab />}
        {active === "call-logs"     && <CallLogsTab />}
        {active === "training-data" && <TrainingTab />}
      </div>
    </div>
  );
}
