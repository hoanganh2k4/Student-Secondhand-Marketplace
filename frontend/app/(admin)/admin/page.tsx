"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/filter-bar";
import UsersTable, { User } from "./_components/user-table";
import TablePagination from "@/components/table-pagination";
import UserStatsCards from "./_components/user-stats-card";
import Toast from "@/components/ui/toast";
import MarketplaceStat from "./_components/marketplace-stat";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

const sortOptions = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "orderCount_desc", label: "Most Orders" },
  { value: "rating_desc", label: "Highest Rated" },
];

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
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
  const [role, setRole] = useState(searchParams.get("role") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "");
  const [sortOrder, setSortOrder] = useState(
    searchParams.get("sortOrder") || "",
  );
  const [offset, setOffset] = useState(
    parseInt(searchParams.get("offset") || "0"),
  );
  const [limit] = useState(20);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (role && role !== "all") params.append("role", role);
    if (sortBy) params.append("sortBy", sortBy);
    if (sortOrder) params.append("sortOrder", sortOrder);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    try {
      const response = await fetch(
        `/api/proxy/admin/users?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();

      setUsers(data);
      setTotal(data.length);

      // Update URL
      const urlParams = new URLSearchParams();
      if (search) urlParams.set("search", search);
      if (status) urlParams.set("status", status);
      if (role && role !== "all") urlParams.set("role", role);
      if (sortBy) urlParams.set("sortBy", sortBy);
      if (sortOrder) urlParams.set("sortOrder", sortOrder);
      if (offset) urlParams.set("offset", offset.toString());

      router.replace(`/admin?${urlParams.toString()}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, status, role, sortBy, sortOrder, offset, limit, router]);

  // Fetch all users for stats (unfiltered, no pagination)
  const fetchAllUsersForStats = useCallback(async () => {
    try {
      const response = await fetch("/api/proxy/admin/users"); // Get all users
      if (!response.ok) throw new Error("Failed to fetch all users");

      const data = await response.json();
      setAllUsers(data);
    } catch (err) {
      console.error("Error fetching all users for stats:", err);
    }
  }, []);

  const handleUserAction = async (
    userId: string,
    action: "suspend" | "ban" | "reinstate",
  ) => {
    try {
      const response = await fetch(
        `/api/proxy/admin/users/${userId}/${action}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) throw new Error(`Failed to ${action} user`);

      setToast({
        message: `User successfully ${action}ed`,
        type: "success",
      });

      // Refresh the list
      await Promise.all([fetchUsers(), fetchAllUsersForStats()]);
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : `Failed to ${action} user`,
        type: "error",
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAllUsersForStats();
  }, [fetchUsers, fetchAllUsersForStats]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setStatus(value);
    if (key === "role") setRole(value);
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
  ];

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MarketplaceStat />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage user accounts, monitor activity, and enforce platform
            policies
          </p>
        </div>

        {/* Stats Cards */}
        <UserStatsCards stats={allUsers} />

        {/* Filters */}
        <FilterBar
          searchPlaceholder="Search by name or email..."
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
              onClick={() => fetchUsers()}
              className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && users.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No users found</p>
            {(search || status || role) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setRole("");
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
        {!loading && !error && users.length > 0 && (
          <>
            <UsersTable users={users} onUserAction={handleUserAction} />
            <TablePagination
              total={total}
              limit={limit}
              offset={offset}
              onPageChange={handlePageChange}
            />
          </>
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
