import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const redirectPath = params.get("redirect");
if (redirectPath && redirectPath.startsWith("/")) {
  window.history.replaceState({}, "", redirectPath);
}

createRoot(document.getElementById("root")!).render(<App />);
