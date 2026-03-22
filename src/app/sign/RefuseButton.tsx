"use client";

type RefuseButtonProps = {
  refuseToken: string | null;
  inspectionId: string | null;
  signerType: string | null;
  email: string | null;
};

export function RefuseButton({
  refuseToken,
  inspectionId,
  signerType,
  email,
}: RefuseButtonProps) {
  if (!refuseToken || !inspectionId || !signerType || !email) return null;

  const goRefuse = () => {
    const q = new URLSearchParams({
      token: refuseToken,
      inspectionId,
      signerType,
      email,
    });
    window.location.href = `/sign/refuse?${q.toString()}`;
  };

  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <p style={{ fontSize: 12, color: "#9B9BA8", margin: "0 0 6px" }}>
        Do you contest the findings of this report?
      </p>
      <button
        type="button"
        onClick={goRefuse}
        style={{
          background: "none",
          border: "none",
          color: "#EF4444",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Refuse to sign this report
      </button>
    </div>
  );
}
