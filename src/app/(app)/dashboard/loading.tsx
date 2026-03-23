export default function DashboardLoading() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#F8F7F4',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <style>{`
        @keyframes snagify-pulse {
          0%, 100% { transform: scale(1);   opacity: 1;    }
          50%       { transform: scale(1.1); opacity: 0.85; }
        }
        @keyframes snagify-ring {
          0%   { transform: scale(0.85); opacity: 0;   }
          50%  { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.5);  opacity: 0;   }
        }
        @keyframes snagify-bar {
          0%   { width: 0%;   opacity: 1; }
          80%  { width: 75%;  opacity: 1; }
          100% { width: 85%;  opacity: 1; }
        }
        @keyframes snagify-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* Ripple rings */}
      <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 28 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid #9A88FD',
            animation: `snagify-ring 2s ease-out ${i * 0.4}s infinite`,
          }} />
        ))}

        {/* Logo icon */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#9A88FD',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'snagify-pulse 2s ease-in-out infinite',
            boxShadow: '0 8px 32px rgba(154,136,253,0.35)',
          }}>
            <img
              src="/icon-512x512.png"
              alt="Snagify"
              width={36}
              height={36}
              style={{ borderRadius: 8, objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>

      {/* Brand name */}
      <p style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 22,
        fontWeight: 800,
        color: '#1A1A1A',
        margin: '0 0 6px',
        letterSpacing: -0.5,
        animation: 'snagify-fade-up 0.6s ease forwards',
      }}>
        Snagify
      </p>
      <p style={{
        fontSize: 13,
        color: '#9CA3AF',
        margin: '0 0 28px',
        animation: 'snagify-fade-up 0.6s ease 0.1s forwards',
        opacity: 0,
      }}>
        Dubai Property Inspections
      </p>

      {/* Progress bar */}
      <div style={{
        width: 160,
        height: 3,
        background: 'rgba(154,136,253,0.15)',
        borderRadius: 99,
        overflow: 'hidden',
        animation: 'snagify-fade-up 0.6s ease 0.2s forwards',
        opacity: 0,
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #9A88FD, #c4b8ff)',
          borderRadius: 99,
          animation: 'snagify-bar 2s cubic-bezier(0.1,0.05,0,1) forwards',
        }} />
      </div>
    </div>
  )
}
