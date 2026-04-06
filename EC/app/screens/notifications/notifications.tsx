import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export function Notifications() {
  const navigate = useNavigate();

  const notifications = [
    {
      id: "1",
      type: "match",
      icon: "🔵",
      title: "New match for your MacBook demand",
      body: "A seller listed a MacBook Air 2020 (87/100 match score)",
      timestamp: "2h ago",
      unread: true,
    },
    {
      id: "2",
      type: "evidence",
      icon: "🟡",
      title: "Evidence request received",
      body: "Sarah Chen requested battery health screenshots",
      timestamp: "5h ago",
      unread: true,
    },
    {
      id: "3",
      type: "offer",
      icon: "🟢",
      title: "Offer received",
      body: "Mike Johnson sent you an offer for $550",
      timestamp: "1d ago",
      unread: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-[#111827]" />
        </button>
        <h1 className="flex-1 text-[20px] font-semibold text-[#111827]">Notifications</h1>
        <button className="text-[#2563EB] text-[13px] font-medium">Mark all read</button>
      </div>

      {/* Notifications grouped by time */}
      <div className="px-4 py-4 space-y-6">
        <div>
          <h2 className="text-[13px] font-medium text-[#4B5563] mb-2">Today</h2>
          <div className="space-y-2">
            {notifications
              .filter((n) => n.timestamp.includes("h"))
              .map((notif) => (
                <button
                  key={notif.id}
                  className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-start gap-3 hover:border-[#2563EB] transition-colors"
                >
                  <div className="text-2xl">{notif.icon}</div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-medium text-[#111827] mb-0.5">{notif.title}</p>
                    <p className="text-[13px] text-[#4B5563] mb-1">{notif.body}</p>
                    <span className="text-[11px] text-[#4B5563]">{notif.timestamp}</span>
                  </div>
                  {notif.unread && <div className="w-2 h-2 bg-[#2563EB] rounded-full mt-1" />}
                </button>
              ))}
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-medium text-[#4B5563] mb-2">Earlier</h2>
          <div className="space-y-2">
            {notifications
              .filter((n) => n.timestamp.includes("d"))
              .map((notif) => (
                <button
                  key={notif.id}
                  className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-start gap-3 hover:border-[#2563EB] transition-colors"
                >
                  <div className="text-2xl">{notif.icon}</div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-medium text-[#111827] mb-0.5">{notif.title}</p>
                    <p className="text-[13px] text-[#4B5563] mb-1">{notif.body}</p>
                    <span className="text-[11px] text-[#4B5563]">{notif.timestamp}</span>
                  </div>
                  {notif.unread && <div className="w-2 h-2 bg-[#2563EB] rounded-full mt-1" />}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
