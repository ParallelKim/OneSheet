import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/geist-pixel/400.css";
import "pretendard/dist/web/static/Pretendard-Regular.css";
import "pretendard/dist/web/static/Pretendard-Bold.css";
import App from "./App.tsx";
import { initFirebaseAnalytics } from "./firebase";

void initFirebaseAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
