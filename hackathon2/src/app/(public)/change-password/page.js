import AuthCard from "../AuthCard";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <AuthCard
      title="Change your password"
      description="If you signed in with a temporary password, choose your own before you continue."
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}
