import AuthCard from "../AuthCard";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthCard title="Log in" description="Use the email and password your admin or HR gave you.">
      <LoginForm />
    </AuthCard>
  );
}
