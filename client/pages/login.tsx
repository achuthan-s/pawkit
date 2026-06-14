import { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import api from "@/lib/api";

const roleLabels: Record<string, string> = {
  customer: "Customer — Pet Parent",
  marketer: "CRM — Marketer",
};

const roleDestinations: Record<string, string> = {
  customer: "/customer/home",
  marketer: "/crm/dashboard",
  operator: "/crm/dashboard",   // operator role maps to CRM
  admin: "/crm/dashboard",      // admin role maps to CRM
};

export default function LoginPage() {
  const router = useRouter();
  const role = (router.query.role as string) ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<{ data: { token: string; user: any } }>("/auth/login", { email, password });
      const authData = data.data;
      if (!authData) throw new Error("Invalid response");
      localStorage.setItem("token", authData.token);
      const dest = roleDestinations[authData.user.role] ?? "/customer/home";
      router.push(dest);
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to PawKit</CardTitle>
          {role && roleLabels[role] && (
            <CardDescription>{roleLabels[role]}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-white"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-white"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
