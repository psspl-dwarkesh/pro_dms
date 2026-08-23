
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";

  // Last-resort net for errors that never reach a React error boundary (event handlers,
  // rejected promises with no .catch, third-party script failures). React boundaries only
  // catch render-phase errors, so this is what stands between those and a silently broken tab.
  window.addEventListener("error", (event) => {
    console.error("[window.onerror]", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[unhandledrejection]", event.reason);
  });

  createRoot(document.getElementById("root")!).render(<App />);
