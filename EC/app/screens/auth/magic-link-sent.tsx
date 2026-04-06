import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Mail } from "lucide-react";
import { Button } from "../../components/ui/button";

export function MagicLinkSent() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "your@email.edu";
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanResend(true);
    }, 60000); // 60 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleResend = () => {
    setCanResend(false);
    setTimeout(() => setCanResend(true), 60000);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center text-center gap-6">
        {/* Email icon */}
        <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center">
          <Mail className="w-8 h-8 text-[#2563EB]" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] mb-3">
            Check your inbox
          </h1>
          <p className="text-[15px] text-[#111827] mb-4">
            We sent a sign-in link to <strong>{email}</strong>. Click the link to access your account.
          </p>
          <p className="text-[13px] text-[#4B5563]">
            Link expires in 10 minutes. Check your spam folder if you don't see it.
          </p>
        </div>

        {/* Action buttons */}
        <div className="w-full space-y-3 pt-4">
          <Button
            onClick={handleResend}
            disabled={!canResend}
            variant="ghost"
            className="w-full text-[#2563EB] hover:bg-[#EFF6FF] disabled:text-[#4B5563] disabled:opacity-50"
          >
            Resend link
          </Button>

          <Button
            onClick={() => navigate("/auth/login")}
            variant="ghost"
            className="w-full text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            Use a different email
          </Button>
        </div>

        {/* Demo link for testing */}
        <div className="mt-8 pt-8 border-t border-[#D1D5DB] w-full">
          <p className="text-[13px] text-[#4B5563] mb-3">For demo purposes:</p>
          <Button
            onClick={() => navigate("/auth/onboarding")}
            className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg"
          >
            Continue to Onboarding
          </Button>
        </div>
      </div>
    </div>
  );
}
