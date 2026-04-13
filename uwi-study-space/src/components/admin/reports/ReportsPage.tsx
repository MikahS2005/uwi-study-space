import ReportsClient from "./ReportsClient";
import AdminSectionBanner from "@/components/admin/shared/AdminSectionBanner";

export default function ReportsPage({ mode }: { mode: "admin" | "super_admin" }) {
  const description =
    mode === "super_admin"
      ? "Analyze booking and waitlist activity across all departments."
      : "Analyze booking and waitlist activity for departments in your scope.";

  return (
    <div className="space-y-6">
      <AdminSectionBanner
        mode={mode}
        areaLabel="Insights"
        title="Reports"
        description={description}
        breadcrumbLabel="Reports"
      />
      <ReportsClient mode={mode} showPageHeader={false} />
    </div>
  );
}