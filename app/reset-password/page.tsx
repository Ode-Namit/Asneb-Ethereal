import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/password-recovery-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="hud-label text-aureate/80">
            Preparing recovery passage...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
