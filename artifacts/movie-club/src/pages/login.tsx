import { useGetMe, useLogin, useRegister } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Film, Popcorn, Eye, EyeOff } from "lucide-react";

const authSchema = z.object({
  username: z
    .string()
    .min(2, "At least 2 characters")
    .max(32, "At most 32 characters")
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, and underscores only"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(100, "Too long"),
});

type AuthFormValues = z.infer<typeof authSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const onSubmit = (data: AuthFormValues) => {
    setServerError(null);
    const payload = {
      username: data.username.trim().toLowerCase(),
      password: data.password,
    };

    if (mode === "login") {
      loginMutation.mutate(
        { data: payload },
        {
          onSuccess: () => setLocation("/dashboard"),
          onError: (err: any) => {
            const msg = err?.response?.data?.error ?? err?.message ?? "Login failed";
            setServerError(msg);
          },
        }
      );
    } else {
      registerMutation.mutate(
        { data: payload },
        {
          onSuccess: () => setLocation("/dashboard"),
          onError: (err: any) => {
            const msg = err?.response?.data?.error ?? err?.message ?? "Registration failed";
            setServerError(msg);
          },
        }
      );
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Film className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      <div className="absolute -left-40 -top-40 w-96 h-96 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute -right-40 -bottom-40 w-96 h-96 bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-card border border-border rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/20">
            <Popcorn className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-3 tracking-tight">Movie Club</h1>
          <p className="text-muted-foreground text-lg">A quiet weekly ritual for film fans.</p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-xl">
          <div className="flex rounded-lg bg-background/50 border border-border/30 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setServerError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "login" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setServerError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "register" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create Account
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs uppercase tracking-wider">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. film_buff"
                        autoComplete="username"
                        className="h-12 bg-background/50 border-border/50 text-base px-4"
                        {...field}
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs uppercase tracking-wider">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                          autoComplete={mode === "register" ? "new-password" : "current-password"}
                          className="h-12 bg-background/50 border-border/50 text-base px-4 pr-12"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium tracking-wide shadow-primary/20 shadow-lg mt-2"
                disabled={isPending}
                data-testid="button-login"
              >
                {isPending
                  ? mode === "login" ? "Signing in..." : "Creating account..."
                  : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-muted-foreground/60 text-sm mt-8">
          Pick, watch, rate, reveal.
        </p>
      </div>
    </div>
  );
}
