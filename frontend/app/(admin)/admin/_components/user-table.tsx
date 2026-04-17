"use client";

import Link from "next/link";
import UserStatusBadge from "./user-status-badge";
import { MoreVertical, UserX, UserCheck, Ban } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { UserStatus } from "./user-status-badge";

export interface User {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  orderCount?: number;
  rating?: number;
}

interface UsersTableProps {
  users: User[];
  onUserAction: (
    userId: string,
    action: "suspend" | "ban" | "reinstate",
  ) => Promise<void>;
}

export default function UsersTable({ users, onUserAction }: UsersTableProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    userId: string;
    action: "suspend" | "ban" | "reinstate";
  } | null>(null);

  const handleAction = (
    userId: string,
    action: "suspend" | "ban" | "reinstate",
  ) => {
    setConfirmDialog({ isOpen: true, userId, action });
    setActionMenuOpen(null);
  };

  const confirmAction = async () => {
    if (confirmDialog) {
      await onUserAction(confirmDialog.userId, confirmDialog.action);
      setConfirmDialog(null);
    }
  };

  const getActionConfig = (action: "suspend" | "ban" | "reinstate") => {
    const configs = {
      suspend: {
        title: "Suspend User",
        message:
          "Are you sure you want to suspend this user? They will not be able to use the platform until reinstated.",
        confirmText: "Suspend",
        type: "warning" as const,
      },
      ban: {
        title: "Ban User",
        message:
          "Are you sure you want to permanently ban this user? This action cannot be undone.",
        confirmText: "Ban",
        type: "danger" as const,
      },
      reinstate: {
        title: "Reinstate User",
        message:
          "Are you sure you want to reinstate this user? They will regain full access to the platform.",
        confirmText: "Reinstate",
        type: "info" as const,
      },
    };
    return configs[action];
  };

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="ml-4">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {user.name}
                      </Link>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <UserStatusBadge status={user.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.orderCount || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-900">
                      {user.rating || 0}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">★</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActionMenuOpen(
                          actionMenuOpen === user.id ? null : user.id,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {actionMenuOpen === user.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActionMenuOpen(null)}
                        />
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1">
                            {user.status === "active" && (
                              <>
                                <button
                                  onClick={() =>
                                    handleAction(user.id, "suspend")
                                  }
                                  className="flex items-center w-full px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Suspend
                                </button>
                                <button
                                  onClick={() => handleAction(user.id, "ban")}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Ban
                                </button>
                              </>
                            )}
                            {(user.status === "suspended" ||
                              user.status === "banned") && (
                              <button
                                onClick={() =>
                                  handleAction(user.id, "reinstate")
                                }
                                className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                Reinstate
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmAction}
          {...getActionConfig(confirmDialog.action)}
        />
      )}
    </>
  );
}
