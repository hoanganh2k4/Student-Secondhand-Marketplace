"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/filter-bar";
import DemandsTable, { Demand } from "./_components/demand-table";
import TablePagination from "@/components/table-pagination";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "waiting", label: "Waiting" },
  { value: "matched", label: "Matched" },
  { value: "in_conversation", label: "In Conversation" },
  { value: "in_negotiation", label: "In Negotiation" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const sortOptions = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "expiresAt_asc", label: "Expiring Soon" },
  { value: "expiresAt_desc", label: "Expiring Later" },
];

export default function AdminDemandsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [demands, setDemands] = useState<Demand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") || "",
  );
  const [sortBy, setSortBy] = useState(
    searchParams.get("sortBy") || "createdAt",
  );
  const [sortOrder, setSortOrder] = useState(
    searchParams.get("sortOrder") || "desc",
  );
  const [offset, setOffset] = useState(
    parseInt(searchParams.get("offset") || "0"),
  );
  const [limit] = useState(20);

  // Categories (fetch from API)
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >([]);

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (categoryId) params.append("categoryId", categoryId);
    if (sortBy) params.append("sortBy", sortBy);
    if (sortOrder) params.append("sortOrder", sortOrder);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    try {
      const response = await fetch(
        `/api/proxy/admin/demands?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch demands");

      const data = await response.json();
      setDemands(data.demands);
      setTotal(data.total);

      // Update URL
      const urlParams = new URLSearchParams();
      if (search) urlParams.set("search", search);
      if (status) urlParams.set("status", status);
      if (categoryId) urlParams.set("categoryId", categoryId);
      if (sortBy) urlParams.set("sortBy", sortBy);
      if (sortOrder) urlParams.set("sortOrder", sortOrder);
      if (offset) urlParams.set("offset", offset.toString());

      router.replace(`/admin/demands?${urlParams.toString()}`, {
        scroll: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, status, categoryId, sortBy, sortOrder, offset, limit, router]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/proxy/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(
          data.map((cat: any) => ({ value: cat.id, label: cat.name })),
        );
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchDemands();
  }, [fetchDemands]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setStatus(value);
    if (key === "categoryId") setCategoryId(value);
    setOffset(0);
  };

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split("_");
    setSortBy(newSortBy);
    setSortOrder(newSortOrder as "asc" | "desc");
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filters = [
    {
      key: "status",
      label: "All statuses",
      options: statusOptions,
      value: status,
    },
    {
      key: "categoryId",
      label: "All categories",
      options: categories,
      value: categoryId,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Demands Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor all buyer demands across the platform
          </p>
        </div>

        {/* Filters */}
        <FilterBar
          searchPlaceholder="Search by title or buyer email..."
          filters={filters}
          sortOptions={sortOptions}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          sortBy={`${sortBy}_${sortOrder}`}
          searchValue={search}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchDemands()}
              className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && demands.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No demands found</p>
            {(search || status || categoryId) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setCategoryId("");
                  setOffset(0);
                }}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!loading && !error && demands.length > 0 && (
          <>
            <DemandsTable demands={demands} />
            <TablePagination
              total={total}
              limit={limit}
              offset={offset}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
