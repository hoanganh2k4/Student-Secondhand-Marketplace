import { useState } from "react";
import { useNavigate } from "react-router";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleContinue = () => {
    setError("");
    
    // Validate university email
    if (!email.includes("@") || !email.includes(".edu")) {
      setError("Only verified university emails are accepted. Check your institution's email.");
      return;
    }

    // Navigate to magic link sent screen
    navigate("/auth/magic-link-sent", { state: { email } });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center text-center gap-6">
        {/* Logo */}
        <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center">
          <div className="text-white text-2xl font-bold">U</div>
        </div>

        {/* App name & tagline */}
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">UniSwap</h1>
          <p className="text-[15px] text-[#4B5563]">
            The marketplace built for your campus.
          </p>
        </div>

        {/* Email input */}
        <div className="w-full space-y-2">
          <label htmlFor="email" className="block text-[12px] font-medium text-[#4B5563] text-left">
            University Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="yourname@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`h-12 border ${
              error ? "border-[#DC2626] border-2" : "border-[#D1D5DB]"
            } rounded-lg focus:border-[#2563EB] focus:border-2`}
          />
          {error && (
            <p className="text-[13px] text-[#DC2626] text-left">{error}</p>
          )}
        </div>

        {/* Continue button */}
        <Button
          onClick={handleContinue}
          className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg font-medium"
        >
          Continue with Email
        </Button>

        {/* Caption */}
        <p className="text-[13px] text-[#4B5563]">
          We'll send you a magic link. No password needed.
        </p>

        {/* Divider */}
        <div className="w-full flex items-center gap-4">
          <div className="flex-1 h-px bg-[#D1D5DB]" />
          <span className="text-[13px] text-[#4B5563]">or</span>
          <div className="flex-1 h-px bg-[#D1D5DB]" />
        </div>

        {/* Learn more link */}
        <button className="text-[#2563EB] text-[15px] hover:underline">
          Learn how it works →
        </button>
      </div>
    </div>
  );
}
