import { createBrowserRouter } from "react-router";
import { Dashboard } from "./components/Dashboard";
import { ClubView } from "./components/ClubView";
import { AdminPanel } from "./components/AdminPanel";
import { MovieSelection } from "./components/MovieSelection";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/club/:clubId",
    Component: ClubView,
  },
  {
    path: "/club/:clubId/admin",
    Component: AdminPanel,
  },
  {
    path: "/club/:clubId/select-movie",
    Component: MovieSelection,
  },
]);
