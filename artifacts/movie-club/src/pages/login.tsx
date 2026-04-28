import { useGetMe, useLogin, useRegister } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Film, Eye, EyeOff } from "lucide-react";
import { VHSNoise } from "@/components/ui/vhs-noise";

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
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <VHSNoise />
        <Film className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <VHSNoise />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-primary border-4 border-secondary flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-secondary" />
          </div>
          <h1 className="text-4xl font-black text-primary uppercase tracking-tight mb-3">Movie Club</h1>
          <p className="text-white/70 text-lg">A weekly ritual for film fans.</p>
        </div>

        {/* Form Card */}
        <div className="bg-card border-8 border-primary p-8">
          {/* Mode Toggle */}
          <div className="flex border-4 border-secondary mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setServerError(null); }}
              className={`flex-1 py-3 text-sm font-black uppercase transition-all ${
                mode === "login"
                  ? "bg-primary text-secondary"
                  : "bg-secondary text-white/70 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setServerError(null); }}
              className={`flex-1 py-3 text-sm font-black uppercase transition-all ${
                mode === "register"
                  ? "bg-primary text-secondary"
                  : "bg-secondary text-white/70 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-xs font-black uppercase tracking-widest">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. film_buff"
                        autoComplete="username"
                        className="h-12 bg-card border-4 border-secondary text-white text-base px-4 placeholder:text-white/40 focus:border-primary"
                        {...field}
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage className="text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-xs font-black uppercase tracking-widest">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                          autoComplete={mode === "register" ? "new-password" : "current-password"}
                          className="h-12 bg-card border-4 border-secondary text-white text-base px-4 pr-12 placeholder:text-white/40 focus:border-primary"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-primary transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-destructive" />
                  </FormItem>
                )}
              />

              {serverError && (
                <div className="bg-destructive border-4 border-destructive text-white px-4 py-3 font-bold uppercase text-sm">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-14 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                disabled={isPending}
                data-testid="button-login"
              >
                {isPending
                  ? mode === "login" ? "Signing in..." : "Creating..."
                  : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </Form>
        </div>

        <p className="text-center text-white/40 text-sm mt-8 font-bold uppercase tracking-wider">
          Pick · Watch · Rate · Reveal
        </p>
      </div>
    </div>
  );
}
