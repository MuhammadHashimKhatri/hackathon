import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import UsersManager from "./UsersManager";

export const metadata = { title: "Users" };

async function UsersView() {
  const actor = await getPageActor();
  const users = await listUsers(actor);
  return <UsersManager users={users} currentUserId={actor.userId} />;
}

export default function UsersPage() {
  return (
    <RoleGate href="/users">
      <UsersView />
    </RoleGate>
  );
}
