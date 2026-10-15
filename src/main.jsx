import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Whiteboard from "./components/Whiteboard.jsx";
import "./index.css";

// Монтируем приложение в корневой элемент страницы.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/board" ? <Whiteboard /> : <App />}
  </StrictMode>,
);
