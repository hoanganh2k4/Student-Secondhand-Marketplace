// frontend/components/admin/OrdersTable.tsx
"use client";

import Link from "next/link";
import OrderStatusBadge, { OrderStatus } from "./order-status-badge";
import FulfillmentBadge, { FulfillmentMethod } from "./fulfillment-badge";
import ConfirmationStatus from "./confirmation-status";
import { AlertCircle } from "lucide-react";

export interface Order {
  id: string;
  status: OrderStatus;
  finalPrice: number;
  quantity: number;
  fulfillmentMethod: FulfillmentMethod;
  buyerConfirmedComplete: boolean;
  sellerConfirmedComplete: boolean;
  completedAt?: string;
  createdAt: string;
  hasDispute: boolean;
  reviewCount: number;
  listing: {
    id: string;
    title: string;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  seller: {
    id: string;
    name: string;
    email: string;
  };
}

interface OrdersTableProps {
  orders: Order[];
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} ₫`;
  };

  const getOrderIdShort = (id: string) => {
    return `#${id.slice(0, 8)}`;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Listing
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Seller
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fulfillment
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Confirmed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="text-sm font-mono font-medium text-blue-600 hover:text-blue-800"
                >
                  {getOrderIdShort(order.id)}
                </Link>
              </td>
              <td className="px-6 py-4">
                <Link
                  href={`/admin/listings/${order.listing.id}`}
                  className="text-sm text-gray-900 hover:text-blue-600 line-clamp-2"
                >
                  {order.listing.title.length > 40
                    ? `${order.listing.title.substring(0, 40)}...`
                    : order.listing.title}
                </Link>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">
                  {order.buyer.name}
                </div>
                <div className="text-xs text-gray-500">{order.buyer.email}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">
                  {order.seller.name}
                </div>
                <div className="text-xs text-gray-500">
                  {order.seller.email}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900">
                  {formatPrice(order.finalPrice)}
                </div>
                <div className="text-xs text-gray-500">
                  Qty: {order.quantity}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <FulfillmentBadge method={order.fulfillmentMethod} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <ConfirmationStatus
                  buyerConfirmed={order.buyerConfirmedComplete}
                  sellerConfirmed={order.sellerConfirmedComplete}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  {order.hasDispute && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(order.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
