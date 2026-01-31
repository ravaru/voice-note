import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// We keep the entrypoint minimal: mount App and leave the rest to pages.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
