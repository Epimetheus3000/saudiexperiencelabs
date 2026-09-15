import "server-only";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function requireMaster() {
  const user = await getCurrentUser();
  if (!user || !user.is_master) {
    throw new Error("Master access required");
  }
  return user;
}
