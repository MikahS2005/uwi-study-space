// src/components/admin/waitlist/WaitlistPage.tsx
import WaitlistManagement from "@/components/admin/waitlist/WaitlistManagement";
import AdminSectionBanner from "@/components/admin/shared/AdminSectionBanner";

export default function WaitlistPage({ mode }: { mode: "admin" | "super_admin" }) {
  const description =
    mode === "super_admin"
      ? "Review and action waitlist entries across all departments."
      : "Review and action waitlist entries for departments in your scope.";

  return (
    <div className="space-y-6">
      <AdminSectionBanner
        mode={mode}
        areaLabel="Reservations"
        title="Waitlist"
        description={description}
        breadcrumbLabel="Waitlist"
      />
      <WaitlistManagement mode={mode} showPageHeader={false} />
    </div>
  );
}