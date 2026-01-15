import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppShell } from "./AppShell";
import { AppRoutes } from "./AppRoutes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <AppRoutes />
    </AppShell>
  </StrictMode>,
);
