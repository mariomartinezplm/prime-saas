import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  // Solo recargar si YA había un Service Worker controlando esta página
  // (o sea, es una actualización real mientras el usuario navegaba).
  // Si es la primera vez que un SW toma control (visita nueva, o cache
  // recién limpiada), no hay nada que refrescar y recargar solo
  // interrumpiría al usuario.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}
