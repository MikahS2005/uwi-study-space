import ReportsClient from "./ReportsClient";

export default function ReportsPage({ mode }: { mode: "admin" | "super_admin" }) {
  return <ReportsClient mode={mode} />;
}