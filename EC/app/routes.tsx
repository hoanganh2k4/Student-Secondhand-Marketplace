import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { AuthLayout } from "./layouts/auth-layout";
import { Login } from "./screens/auth/login";
import { MagicLinkSent } from "./screens/auth/magic-link-sent";
import { Onboarding } from "./screens/auth/onboarding";
import { Home } from "./screens/home/home";
import { CreateDemand } from "./screens/demands/create-demand";
import { DemandDetail } from "./screens/demands/demand-detail";
import { CreateListing } from "./screens/listings/create-listing";
import { ListingDetail } from "./screens/listings/listing-detail";
import { MatchDetail } from "./screens/matches/match-detail";
import { ConversationList } from "./screens/conversations/conversation-list";
import { ConversationThread } from "./screens/conversations/conversation-thread";
import { OrderDetail } from "./screens/orders/order-detail";
import { Profile } from "./screens/profile/profile";
import { Notifications } from "./screens/notifications/notifications";
import { DemandsScreen } from "./screens/demands/demands-screen";
import { ListingsScreen } from "./screens/listings/listings-screen";

export const router = createBrowserRouter([
  {
    path: "/auth",
    Component: AuthLayout,
    children: [
      { path: "login", Component: Login },
      { path: "magic-link-sent", Component: MagicLinkSent },
      { path: "onboarding", Component: Onboarding },
    ],
  },
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: "demands", Component: DemandsScreen },
      { path: "demands/new", Component: CreateDemand },
      { path: "demands/:id", Component: DemandDetail },
      { path: "listings", Component: ListingsScreen },
      { path: "listings/new", Component: CreateListing },
      { path: "listings/:id", Component: ListingDetail },
      { path: "matches/:id", Component: MatchDetail },
      { path: "conversations", Component: ConversationList },
      { path: "conversations/:id", Component: ConversationThread },
      { path: "orders/:id", Component: OrderDetail },
      { path: "profile", Component: Profile },
      { path: "notifications", Component: Notifications },
    ],
  },
]);
