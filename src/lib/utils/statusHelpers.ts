export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_progress: "Draft",
    completed: "Completed",
    pending_signatures: "Pending Signatures",
    signed: "Signed",
    disputed: "Disputed",
    expired: "Expired",
  };
  return labels[status] ?? status;
}
