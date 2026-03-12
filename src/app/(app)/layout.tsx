import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen bg-[#fcfcfc] pb-16 max-w-lg mx-auto">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
