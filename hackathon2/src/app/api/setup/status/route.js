import { connection } from "next/server";
import { withApi } from "@/server/http";
import { getSetupStatus } from "@/server/services/setup";

// Public: tells /setup whether first-run setup is still open.
export const GET = withApi(async () => {
  await connection();
  return Response.json(await getSetupStatus());
});
