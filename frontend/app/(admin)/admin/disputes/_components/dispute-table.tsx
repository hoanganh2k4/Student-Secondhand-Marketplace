"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import DisputeStatusBadge, { DisputeStatus } from "./dispute-status-badge";

export interface Dispute {
  id: string;
  disputeType?: string;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  openedAt: string;
  resolvedAt?: string;
  order: { id: string; finalPrice: number };
  filedBy: { id: string; name: string; email: string };
}

interface Props {
  disputes: Dispute[];
}

export default function DisputeTable({ disputes }: Props) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Dispute ID", "Filed By", "Order", "Type", "Status", "Opened", ""].map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {disputes.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/admin/disputes/${d.id}`}
                  className="text-sm font-mono font-medium text-blue-600 hover:text-blue-800"
                >
                  #{d.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">{d.filedBy.name}</div>
                <div className="text-xs text-gray-500">{d.filedBy.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/admin/orders/${d.order.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  #{d.order.id.slice(0, 8)}
                </Link>
                <div className="text-xs text-gray-500">
                  {Number(d.order.finalPrice).toLocaleString()} ₫
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-xs text-gray-600 capitalize">
                  {d.disputeType?.replace(/_/g, " ") ?? "—"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <DisputeStatusBadge status={d.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(d.openedAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/admin/disputes/${d.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
