import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Boards, Specimens } from "./components/Specimens";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.DEV && location.hash === "#specimens" ? <Specimens /> : import.meta.env.DEV && location.hash === "#boards" ? <Boards /> : <App />}
  </StrictMode>,
);
