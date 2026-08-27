import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { resolveInitialRoute } from "./lib/routing";
import "./styles.css";

resolveInitialRoute();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
