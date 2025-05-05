import { auth } from "@weldr/auth";
import { headers } from "next/headers";

export async function getActiveSubscription() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const subscriptions = await auth.api.listActiveSubscriptions({
    headers: await headers(),
  });

  const activeSubscription = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );

  if (!activeSubscription) {
    return null;
  }

  return activeSubscription;
}
