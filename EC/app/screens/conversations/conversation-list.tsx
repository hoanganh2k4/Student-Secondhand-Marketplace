import { useNavigate } from "react-router";
import { Filter } from "lucide-react";
import { StatusBadge } from "../../components/status-badge";

export function ConversationList() {
  const navigate = useNavigate();

  const conversations = [
    {
      id: "1",
      productTitle: "Calculus Textbook 8th Edition",
      counterpartyName: "Sarah Chen",
      lastMessage: "Yes, I can meet at the library tomorrow!",
      timestamp: "2h ago",
      unreadCount: 2,
      stage: "negotiation",
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=200&fit=crop",
      trustTier: "trusted" as const,
    },
    {
      id: "2",
      productTitle: "MacBook Air M1 2020",
      counterpartyName: "Mike Johnson",
      lastMessage: "Here are the battery health screenshots",
      timestamp: "5h ago",
      unreadCount: 0,
      stage: "verification",
      thumbnail: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200&h=200&fit=crop",
      trustTier: "established" as const,
    },
  ];

  const stageDotColor: Record<string, string> = {
    verification: "bg-[#2563EB]",
    clarification: "bg-[#D97706]",
    negotiation: "bg-[#16A34A]",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[20px] font-semibold text-[#111827]">Conversations</h1>
          <button>
            <Filter className="w-5 h-5 text-[#4B5563]" />
          </button>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-full bg-[#2563EB] text-white text-[13px] font-medium">
            All
          </button>
          <button className="px-3 py-1.5 rounded-full bg-[#F3F4F6] text-[#4B5563] text-[13px] font-medium">
            Active
          </button>
          <button className="px-3 py-1.5 rounded-full bg-[#F3F4F6] text-[#4B5563] text-[13px] font-medium">
            Awaiting You
          </button>
        </div>
      </div>

      {/* Awaiting action banner */}
      <div className="mx-4 mt-4 bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl p-3">
        <p className="text-[14px] text-[#D97706]">
          You have 2 conversations waiting for your response.
        </p>
      </div>

      {/* Conversation list */}
      <div className="px-4 py-4 space-y-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => navigate(`/conversations/${conv.id}`)}
            className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-start gap-3 hover:border-[#2563EB] transition-colors"
          >
            <div className="relative flex-shrink-0">
              <img
                src={conv.thumbnail}
                alt={conv.productTitle}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                  stageDotColor[conv.stage]
                }`}
              />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[14px] font-medium text-[#111827]">
                  {conv.counterpartyName}
                </span>
                <StatusBadge variant="verified">Trusted</StatusBadge>
              </div>
              <p className="text-[13px] text-[#4B5563] line-clamp-1 mb-1">
                {conv.productTitle}
              </p>
              <p className="text-[13px] text-[#4B5563] italic line-clamp-1">
                {conv.lastMessage}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[11px] text-[#4B5563]">{conv.timestamp}</span>
              {conv.unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                  <span className="text-[11px] font-medium text-white">{conv.unreadCount}</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
