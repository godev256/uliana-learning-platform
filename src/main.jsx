import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AccountApp from "./account/AccountApp.jsx";
import LocalTopicBoards from "./components/board-topics.jsx";
import "./index.css";

// Монтируем приложение в корневой элемент страницы.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {window.location.pathname.startsWith("/cabinet") ? <AccountApp/> : window.location.pathname.replace(/\/$/, "") === "/board" ? <LocalTopicBoards /> : <App />}
  </StrictMode>,
);
