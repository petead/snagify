import BottomNav from "@/components/layout/BottomNav";
import { AuthGuard } from "@/components/AuthGuard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <>
        <div className="min-h-screen bg-[#F8F7F4] pb-16 max-w-lg mx-auto">
          {children}
        </div>
        <BottomNav />
      </>
    </AuthGuard>
  );
}
