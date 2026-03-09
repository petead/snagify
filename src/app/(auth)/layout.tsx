import Link from "next/link";

const FEATURES = [
  "AI-powered contract extraction",
  "Digital signatures & PDF reports",
  "RERA compliant documentation",
];

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M28 4L52 16v24L28 52 4 40V16L28 4z"
        stroke="white"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M28 24v20M20 32l8-8 8 8M22 44h12"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-body antialiased">
      <div className="flex min-h-screen">
        {/* Left panel — desktop only, 45% */}
        <div
          className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center px-12 py-16 animate-gradient"
          style={{
            background: "linear-gradient(135deg, #9A88FD 0%, #7B65FC 50%, #9A88FD 100%)",
          }}
        >
          <div className="max-w-md w-full flex flex-col items-center text-center">
            <LogoIcon className="w-14 h-14 text-white mb-6 flex-shrink-0" />
            <h1 className="font-heading font-extrabold text-white text-[32px] leading-tight mb-4">
              Snagify
            </h1>
            <p
              className="font-heading font-bold text-white text-2xl leading-[1.2] mb-4"
              style={{ lineHeight: 1.2 }}
            >
              Smart Inspections.
              <br />
              Smarter Rentals.
            </p>
            <p className="font-body text-white text-sm mb-10 opacity-70">
              The fastest way to create legally-sound property inspection reports
              in Dubai 🇦🇪
            </p>
            <ul className="space-y-4 w-full text-left mb-12">
              {FEATURES.map((text) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="font-body text-white text-sm">{text}</span>
                </li>
              ))}
            </ul>
            <p className="font-body text-white text-xs opacity-50">
              Trusted by Dubai real estate professionals
            </p>
          </div>
        </div>

        {/* Right panel — 55% desktop, 100% mobile */}
        <div className="flex-1 flex flex-col min-h-screen bg-[#fcfcfc] lg:min-w-0">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center justify-center py-5 px-4 bg-[#9A88FD]">
            <Link href="/" className="flex items-center gap-2">
              <LogoIcon className="w-9 h-9 text-white flex-shrink-0" />
              <span className="font-heading font-extrabold text-white text-xl">
                Snagify
              </span>
            </Link>
          </header>

          {/* Form area */}
          <div className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 lg:py-10">
            <div className="w-full max-w-[380px] py-8 px-0 sm:px-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
