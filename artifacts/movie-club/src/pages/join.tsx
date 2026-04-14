import { useJoinGroup, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  code: z.string().min(4, "Enter a valid invite code").max(20),
});

type FormValues = z.infer<typeof schema>;

export default function Join() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const joinGroup = useJoinGroup();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const onSubmit = (data: FormValues) => {
    joinGroup.mutate(
      { data: { code: data.code } },
      {
        onSuccess: (group) => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: `Joined "${group.name}"!` });
          setLocation(`/groups/${group.id}`);
        },
        onError: (e: any) => {
          toast({
            title: "Could not join",
            description: e.data?.error ?? "Invalid or expired invite code",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-serif font-semibold">Join a Club</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">Join with Code</h1>
              <p className="text-muted-foreground text-sm">Enter the invite code from your friend.</p>
            </div>
          </div>

          <div className="bg-card/50 border border-border/30 rounded-xl p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. A1B2C3"
                          className="h-11 bg-background/50 font-mono tracking-widest uppercase"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={joinGroup.isPending}
                >
                  {joinGroup.isPending ? "Joining..." : "Join Club"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
    </div>
  );
}
