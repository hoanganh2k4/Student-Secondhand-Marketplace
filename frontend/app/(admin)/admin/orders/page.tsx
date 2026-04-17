"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/filter-bar";
import OrdersTable from "./_components/order-table";
import TablePagination from "@/components/table-pagination";
import Toast from "@/components/ui/toast";
import { Order } from "./_components/order-table";

const statusOptions = [
  { value: "created", label: "Created" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
];

const fulfillmentOptions = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
  { value: "flexible", label: "Flexible" },
];

const sortOptions = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "finalPrice_desc", label: "Highest Amount" },
  { value: "finalPrice_asc", label: "Lowest Amount" },
  { value: "completedAt_desc", label: "Recently Completed" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Filter states
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [fulfillmentMethod, setFulfillmentMethod] = useState(
    searchParams.get("fulfillmentMethod") || "",
  );
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") || "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") || "");
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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (fulfillmentMethod)
      params.append("fulfillmentMethod", fulfillmentMethod);
    if (fromDate) params.append("fromDate", fromDate);
    if (toDate) params.append("toDate", toDate);
    if (sortBy) params.append("sortBy", sortBy);
    if (sortOrder) params.append("sortOrder", sortOrder);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    try {
      const response = await fetch(
        `/api/proxy/admin/orders?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch orders");

      const data = await response.json();
      setOrders(data.orders);
      setTotal(data.total);

      // Update URL
      const urlParams = new URLSearchParams();
      if (search) urlParams.set("search", search);
      if (status) urlParams.set("status", status);
      if (fulfillmentMethod)
        urlParams.set("fulfillmentMethod", fulfillmentMethod);
      if (fromDate) urlParams.set("fromDate", fromDate);
      if (toDate) urlParams.set("toDate", toDate);
      if (sortBy) urlParams.set("sortBy", sortBy);
      if (sortOrder) urlParams.set("sortOrder", sortOrder);
      if (offset) urlParams.set("offset", offset.toString());

      router.replace(`/admin/orders?${urlParams.toString()}`, {
        scroll: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    status,
    fulfillmentMethod,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
    offset,
    limit,
    router,
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setStatus(value);
    if (key === "fulfillmentMethod") setFulfillmentMethod(value);
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
      key: "fulfillmentMethod",
      label: "All fulfillment",
      options: fulfillmentOptions,
      value: fulfillmentMethod,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage all transactions between buyers and sellers
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search by buyer/seller email or listing title..."
            filters={filters}
            sortOptions={sortOptions}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onSortChange={handleSortChange}
            sortBy={`${sortBy}_${sortOrder}`}
            searchValue={search}
          />

          {/* Date Range Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setOffset(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setOffset(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {(fromDate || toDate) && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setOffset(0);
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12 mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchOrders()}
              className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
            <p className="text-gray-500">No orders found</p>
            {(search || status || fulfillmentMethod || fromDate || toDate) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setFulfillmentMethod("");
                  setFromDate("");
                  setToDate("");
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
        {!loading && !error && orders.length > 0 && (
          <div className="mt-6">
            <OrdersTable orders={orders} />
            <TablePagination
              total={total}
              limit={limit}
              offset={offset}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
