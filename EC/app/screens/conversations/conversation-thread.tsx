import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MoreVertical, Send, Paperclip } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function ConversationThread() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [message, setMessage] = useState("");
  const [stage] = useState<"verification" | "clarification" | "negotiation">("clarification");

  const messages = [
    {
      id: "1",
      type: "system",
      content: "Match found. You are interested in Sarah's Calculus Textbook. Review the proof below before chatting.",
      timestamp: "Today, 10:00 AM",
    },
    {
      id: "2",
      type: "received",
      sender: "Sarah Chen",
      content: "Hi! Thanks for your interest. The textbook is in great condition.",
      timestamp: "10:15 AM",
    },
    {
      id: "3",
      type: "sent",
      content: "Great! Does it have any highlighting or notes inside?",
      timestamp: "10:20 AM",
    },
    {
      id: "4",
      type: "received",
      sender: "Sarah Chen",
      content: "Just a few pencil notes in the first two chapters, nothing major. I can show you photos if you'd like.",
      timestamp: "10:22 AM",
    },
  ];

  const handleSend = () => {
    if (message.trim()) {
      // Send message logic
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6 text-[#111827]" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-medium">
              S
            </div>
            <span className="text-[17px] font-semibold text-[#111827]">Sarah Chen</span>
          </div>
          <button>
            <MoreVertical className="w-6 h-6 text-[#4B5563]" />
          </button>
        </div>

        {/* Stage progress bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center mb-1">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[11px] text-[#4B5563]">Verification</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#16A34A]" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center mb-1">
              <span className="text-white text-sm font-medium">2</span>
            </div>
            <span className="text-[11px] text-[#2563EB] font-medium">Clarification</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#D1D5DB]" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-[#D1D5DB] flex items-center justify-center mb-1">
              <span className="text-[#4B5563] text-sm font-medium">3</span>
            </div>
            <span className="text-[11px] text-[#4B5563]">Negotiation</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          if (msg.type === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-sm bg-[#EFF6FF] border-l-4 border-[#2563EB] rounded-lg p-3">
                  <p className="text-[13px] text-[#111827] italic">{msg.content}</p>
                  <p className="text-[11px] text-[#4B5563] mt-1">{msg.timestamp}</p>
                </div>
              </div>
            );
          }

          if (msg.type === "received") {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[75%]">
                  <p className="text-[11px] text-[#4B5563] mb-1">{msg.sender}</p>
                  <div className="bg-[#F3F4F6] rounded-2xl rounded-tl-none px-4 py-2.5">
                    <p className="text-[14px] text-[#111827]">{msg.content}</p>
                  </div>
                  <p className="text-[11px] text-[#4B5563] mt-1">{msg.timestamp}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[75%]">
                <div className="bg-[#2563EB] rounded-2xl rounded-tr-none px-4 py-2.5">
                  <p className="text-[14px] text-white">{msg.content}</p>
                </div>
                <p className="text-[11px] text-[#4B5563] mt-1 text-right">{msg.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating action button */}
      {stage === "clarification" && (
        <div className="px-4 pb-2">
          <Button className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-full">
            Ready to make an offer →
          </Button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-[#D1D5DB] p-4 pb-24">
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
            <Paperclip className="w-5 h-5 text-[#4B5563]" />
          </button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 h-10 border-[#D1D5DB] rounded-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            className="p-2 bg-[#2563EB] hover:bg-[#1d4ed8] rounded-full transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        <p className="text-[11px] text-[#4B5563] text-center mt-2">
          9 messages remaining this hour
        </p>
      </div>
    </div>
  );
}
