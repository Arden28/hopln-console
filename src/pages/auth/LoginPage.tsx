import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ZapIcon, Loader2Icon } from "lucide-react";

export function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) router.navigate({ to: "/" });
  }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, token } = await login(email, password);
      const allowed = ["moderator", "admin", "superadmin"];
      if (!allowed.includes(user.role)) {
        setError("Your account does not have console access.");
        return;
      }
      setAuth(user, token);
      toast.success(`Welcome back, ${user.name}`);
      router.navigate({ to: "/" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ZapIcon size={16} className="fill-current" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Hopln Console</span>
        </div>

        {/* Form centred */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Sign in to Console</h1>
                <p className="text-sm text-muted-foreground text-balance">
                  Enter your admin credentials to access the Hopln management dashboard.
                </p>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@hopln.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Access restricted to Hopln team members with moderator or admin role.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Right — branded panel */}
      <div className="relative hidden lg:flex flex-col items-center justify-center bg-linear-to-br from-orange-600 via-orange-500 to-amber-400 text-white p-12">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-sm text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <ZapIcon size={32} className="fill-current" />
            </div>
          </div>
          <blockquote className="text-xl font-semibold leading-relaxed">
            "Connecting Nairobi's commuters with real-time matatu routing — one journey at a time."
          </blockquote>
          <p className="text-sm text-white/80">
            Hopln Console — Internal management dashboard for the Hopln transit platform.
          </p>
        </div>
      </div>
    </div>
  );
}
