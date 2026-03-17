import { useEffect, useState, useCallback } from "react";

export interface CreditsState {
  balance: number;
  plan: string;
  accountType: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useCredits(): CreditsState {
  const [state, setState] = useState<CreditsState>({
    balance: 0,
    plan: "free",
    accountType: "individual",
    loading: true,
    refresh: async () => {},
  });

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance", { method: "GET" });
      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      const data = (await res.json()) as {
        balance?: number;
        plan?: string;
        account_type?: string;
      };
      setState((prev) => ({
        ...prev,
        balance: Number(data.balance ?? 0),
        plan: data.plan ?? "free",
        accountType: data.account_type ?? "individual",
        loading: false,
      }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    setState((prev) => ({ ...prev, refresh: fetchCredits }));
    void fetchCredits();
  }, [fetchCredits]);

  return state;
}
