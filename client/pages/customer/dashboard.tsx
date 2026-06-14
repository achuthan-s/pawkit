// Redirect to /customer/home
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CustomerDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/customer/home"); }, [router]);
  return null;
}
