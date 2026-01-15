import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppShell } from "./AppShell";
import { AppRoutes } from "./AppRoutes";
import { publicRoutes } from "./routes/publicRoutes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <AppRoutes publicRouteEntries={publicRoutes} />
    </AppShell>
  </StrictMode>,
);
