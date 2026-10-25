import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Locally bundled Inter Variable (required by prd.md design tokens).
import "@fontsource-variable/inter";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
