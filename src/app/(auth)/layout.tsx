import { SnagifyLogo } from "@/components/ui/SnagifyLogo";

const FEATURE_PILLS = [
  "📋 AI-Powered Reports",
  "✍️ Digital Signatures",
  "🏢 RERA Compliant",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel (desktop only) ── */}
      <div
        className="relative hidden lg:flex lg:w-[45%] flex-col justify-between p-10 overflow-hidden"
        style={{
          backgroundColor: "#9A88FD",
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <SnagifyLogo size="lg" variant="light" />

        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h1 className="font-heading font-extrabold text-white text-4xl xl:text-5xl leading-tight mb-5">
            Smart Inspections.
            <br />
            Smarter Rentals.
          </h1>
          <p className="font-body text-white/70 text-base leading-relaxed mb-8">
            The fastest way to create legally-sound property inspection reports
            in Dubai.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {FEATURE_PILLS.map((pill) => (
              <span
                key={pill}
                className="font-body text-sm text-white bg-white/20 px-4 py-2 rounded-full"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-end justify-between">
          <p className="font-body text-xs text-white/60">
            Trusted by Dubai real estate professionals
          </p>
          <span className="text-6xl opacity-20 select-none leading-none">
            🇦🇪
          </span>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col min-h-screen bg-brand-white">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-center py-5 bg-brand-purple">
          <SnagifyLogo size="sm" variant="light" />
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
