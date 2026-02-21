import SidebarLayout from "@/components/layout/SidebarLayout";
import { ProfileCompletionGate } from "@/components/auth/ProfileCompletionGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {

      return (
      <>
      <ProfileCompletionGate />
      <SidebarLayout>{children}</SidebarLayout>
      </>
      );
}
