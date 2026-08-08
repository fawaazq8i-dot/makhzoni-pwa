const VIEWS = ["add", "stock", "dashboard"];
const listeners = [];

function currentView() {
  const hash = (location.hash || "#add").replace("#", "");
  return VIEWS.includes(hash) ? hash : "add";
}

function render() {
  const view = currentView();
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `view-${view}`);
  });
  document.querySelectorAll(".nav-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
  listeners.forEach((fn) => fn(view));
}

function onNavigate(fn) {
  listeners.push(fn);
}

function goto(view) {
  location.hash = `#${view}`;
}

export function initRouter() {
  window.addEventListener("hashchange", render);
  render();
}

export const router = { onNavigate, goto, currentView };
