import { redirect } from "next/navigation";

// Prompt 3's proxy sends a fresh install to /setup and logged-out users to /login.
export default function Home() {
  redirect("/dashboard");
}
