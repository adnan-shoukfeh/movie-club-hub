import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import GroupsNew from "./pages/groups-new";
import GroupDetail from "./pages/group-detail";
import GroupAdmin from "./pages/group-admin";
import GroupResults from "./pages/group-results";
import AcceptInvite from "./pages/accept-invite";
import Join from "./pages/join";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Switch>
            <Route path="/" component={Login} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/groups/new" component={GroupsNew} />
            <Route path="/groups/:groupId/results" component={GroupResults} />
            <Route path="/groups/:groupId/admin" component={GroupAdmin} />
            <Route path="/groups/:groupId" component={GroupDetail} />
            <Route path="/invite/:code" component={AcceptInvite} />
            <Route path="/join" component={Join} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
