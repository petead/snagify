"use client";

interface Props {
  contractFrom: string;
  contractTo: string;
}

export default function ContractProgress({ contractFrom, contractTo }: Props) {
  const start = new Date(contractFrom).getTime();
  const end = new Date(contractTo).getTime();
  const now = new Date().getTime();
  const progress = Math.min(
    100,
    Math.max(0, ((now - start) / (end - start)) * 100)
  );
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const barColor =
    daysLeft <= 30 ? "#F59E0B" : daysLeft <= 90 ? "#9A88FD" : "#cafe87";

  return (
    <div className="mt-3 pt-3 border-t border-gray-50">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">Contract duration</span>
        <span className="text-xs font-semibold" style={{ color: barColor }}>
          {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
