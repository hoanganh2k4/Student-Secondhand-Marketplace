// frontend/components/admin/ConfirmationStatus.tsx
import { CheckCircle, XCircle } from "lucide-react";

interface ConfirmationStatusProps {
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
}

export default function ConfirmationStatus({
  buyerConfirmed,
  sellerConfirmed,
}: ConfirmationStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {buyerConfirmed ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-xs text-gray-600">Buyer</span>
      </div>
      <div className="flex items-center gap-1">
        {sellerConfirmed ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-xs text-gray-600">Seller</span>
      </div>
    </div>
  );
}
