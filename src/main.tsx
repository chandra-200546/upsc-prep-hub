import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installVolatileStorage } from "./lib/volatile-storage";

const params = new URLSearchParams(window.location.search);
const redirectPath = params.get("redirect");
if (redirectPath && redirectPath.startsWith("/")) {
  window.history.replaceState({}, "", redirectPath);
}

installVolatileStorage();

createRoot(document.getElementById("root")!).render(<App />);
