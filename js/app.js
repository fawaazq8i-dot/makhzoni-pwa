import { initRouter, router } from "./router.js";
import { mountAddProduct, unmountAddProduct } from "./features/addProduct.js";
import { mountStock, unmountStock } from "./features/stock.js";
import { mountDashboard } from "./features/dashboard.js";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Offline-first is a progressive enhancement; the app still works without it.
    });
  });
}

function wireBottomNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => router.goto(btn.dataset.view));
  });
}

function init() {
  registerServiceWorker();
  initRouter();
  wireBottomNav();

  mountAddProduct(document.getElementById("add-root"));
  mountStock(document.getElementById("stock-root"));
  mountDashboard(document.getElementById("dashboard-root"));

  // Every tab shows data that can change from another tab (a product added,
  // marked sold) — re-mount each tab's content every time it's shown, and
  // clean up per-tab resources (blob object URLs) when leaving it.
  router.onNavigate((view) => {
    if (view === "add") mountAddProduct(document.getElementById("add-root"));
    else unmountAddProduct();

    if (view === "stock") mountStock(document.getElementById("stock-root"));
    else unmountStock();

    if (view === "dashboard") mountDashboard(document.getElementById("dashboard-root"));
  });
}

document.addEventListener("DOMContentLoaded", init);
