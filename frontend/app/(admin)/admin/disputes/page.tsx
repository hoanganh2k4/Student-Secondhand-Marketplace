"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/filter-bar";
import DisputeTable, { Dispute } from "./_components/dispute-table";
import Toast from "@/components/ui/toast";

const statusOptions = [
  { value: "opened",       label: "Opened" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved",     label: "Resolved" },
  { value: "closed",       label: "Closed" },
];

const sortOptions = [
  { value: "openedAt_desc",  label: "Newest First" },
  { value: "openedAt_asc",   label: "Oldest First" },
  { value: "resolvedAt_desc", label: "Recently Resolved" },
];

export default function AdminDisputesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [disputes, setDisputes]   = useState<Dispute[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [toast, setToast]         = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [search,    setSearch]    = useState(searchParams.get("search") || "");
  const [status,    setStatus]    = useState(searchParams.get("status") || "");
  const [sortBy,    setSortBy]    = useState(searchParams.get("sortBy") || "openedAt");
  const [sortOrder, setSortOrder] = useState(searchParams.get("sortOrder") || "desc");

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/admin/disputes");
      if (!res.ok) throw new Error("Failed to fetch disputes");
      const data: Dispute[] = await res.json();

      let filtered = data;
      if (status) filtered = filtered.filter((d) => d.status === status);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.filedBy.name.toLowerCase().includes(q) ||
            d.filedBy.email.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q),
        );
      }

      filtered.sort((a, b) => {
        const field = sortBy as "openedAt" | "resolvedAt";
        const av = a[field] ? new Date(a[field]!).getTime() : 0;
        const bv = b[field] ? new Date(b[field]!).getTime() : 0;
        return sortOrder === "asc" ? av - bv : bv - av;
      });

      setDisputes(filtered);

      const urlParams = new URLSearchParams();
      if (search) urlParams.set("search", search);
      if (status) urlParams.set("status", status);
      if (sortBy) urlParams.set("sortBy", sortBy);
      if (sortOrder) urlParams.set("sortOrder", sortOrder);
      router.replace(`/admin/disputes?${urlParams.toString()}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, status, sortBy, sortOrder, router]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split("_");
    setSortBy(newSortBy);
    setSortOrder(newSortOrder as "asc" | "desc");
  };

  const filters = [
    { key: "status", label: "All statuses", options: statusOptions, value: status },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and resolve disputes filed by buyers or sellers
          </p>
        </div>

        <FilterBar
          searchPlaceholder="Search by name, email, or dispute ID..."
          filters={filters}
          sortOptions={sortOptions}
          onSearch={(v) => setSearch(v)}
          onFilterChange={(key, value) => { if (key === "status") setStatus(value); }}
          onSortChange={handleSortChange}
          sortBy={`${sortBy}_${sortOrder}`}
          searchValue={search}
        />

        {loading && (
          <div className="flex justify-center items-center py-12 mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
            <p className="text-red-600">{error}</p>
            <button onClick={fetchDisputes} className="mt-2 text-sm text-red-700 font-medium hover:text-red-800">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && disputes.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
            <p className="text-gray-500">No disputes found</p>
            {(search || status) && (
              <button
                onClick={() => { setSearch(""); setStatus(""); }}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {!loading && !error && disputes.length > 0 && (
          <div className="mt-6">
            <DisputeTable disputes={disputes} />
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
