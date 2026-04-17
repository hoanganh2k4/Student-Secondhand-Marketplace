"use client";

import Link from "next/link";

import DemandStatusBadge, { DemandStatus } from "./demand-status-badge";

export interface Demand {
  id: string;
  title: string;
  status: DemandStatus;
  budgetMin: string;
  budgetMax: string;
  preferredCondition: string;
  location: string;
  urgency: string;
  expiresAt: string;
  createdAt: string;
  matchCount: number;
  category: {
    id: string;
    name: string;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
}

interface DemandsTableProps {
  demands: Demand[];
}

export default function DemandsTable({ demands }: DemandsTableProps) {
  const formatBudget = (min: string, max: string) => {
    const minNum = parseInt(min);
    const maxNum = parseInt(max);

    if (minNum === 0 && maxNum === 0) return "N/A";
    if (minNum === 0) return `${maxNum.toLocaleString()} ₫`;
    if (maxNum === 0) return `${minNum.toLocaleString()} ₫`;
    return `${minNum.toLocaleString()} – ${maxNum.toLocaleString()} ₫`;
  };

  const isExpiringSoon = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry < 3 && daysUntilExpiry > 0;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Matches
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expires
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {demands.map((demand) => (
            <tr key={demand.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <Link
                  href={`/admin/demands/${demand.id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium line-clamp-2"
                >
                  {demand.title.length > 45
                    ? `${demand.title.substring(0, 45)}...`
                    : demand.title}
                </Link>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">
                  {demand.buyer.name}
                </div>
                <div className="text-sm text-gray-500">
                  {demand.buyer.email}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                  {demand.category.name}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {formatBudget(demand.budgetMin, demand.budgetMax)}
              </td>
              <td className="px-6 py-4">
                <DemandStatusBadge status={demand.status} />
              </td>
              <td className="px-6 py-4">
                {demand.matchCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {demand.matchCount}
                  </span>
                ) : (
                  <span className="text-gray-400">0</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={
                    isExpiringSoon(demand.expiresAt)
                      ? "text-red-600 font-medium"
                      : "text-gray-500"
                  }
                >
                  {new Date(demand.expiresAt).getUTCDate()}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(demand.createdAt).getUTCDate()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
