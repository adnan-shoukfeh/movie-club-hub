import { useCreateGroup, getListGroupsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
});

type FormValues = z.infer<typeof schema>;

export default function GroupsNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createGroup = useCreateGroup();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const onSubmit = (data: FormValues) => {
    createGroup.mutate(
      { data: { name: data.name } },
      {
        onSuccess: (group) => {
          queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          setLocation(`/groups/${group.id}`);
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
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold">New Club</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="max-w-md">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Start a Movie Club</h1>
          <p className="text-muted-foreground mb-8">Give your group a name and invite your friends.</p>

          <div className="bg-card/50 border border-border/30 rounded-xl p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Club name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Friday Night Films"
                          className="h-11 bg-background/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 flex-1"
                    disabled={createGroup.isPending}
                  >
                    {createGroup.isPending ? "Creating..." : "Create Club"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation("/dashboard")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </main>
    </div>
  );
}
