/**
 * @file main.tsx
 * @module engage-mt/staff
 * @description SPA entry. Mounts the router. Styling is a small FWP-token design
 *              system (semantic HTML); a Calcite restyle is a documented follow-up so
 *              this internal tool ships without the CDN-free asset pipeline blocking it.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-03
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
