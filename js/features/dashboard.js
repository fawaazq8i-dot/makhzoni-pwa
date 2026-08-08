import { mountDaySwitcher, getSelectedDate } from "./daySwitcher.js";
import { getProductsBySoldDate, getProductsByStatus } from "../db.js";

let rootEl = null;

export async function getDaySummary(dateKey) {
  const sold = await getProductsBySoldDate(dateKey);
  let profit = 0;
  let loss = 0;
  for (const p of sold) {
    const diff = p.sellPrice - p.costPrice;
    if (diff > 0) profit += diff;
    else if (diff < 0) loss += -diff;
  }
  return { profit, loss, count: sold.length };
}

export async function getCurrentCapital() {
  const inStock = await getProductsByStatus("in-stock");
  return inStock.reduce((sum, p) => sum + p.costPrice, 0);
}

export function mountDashboard(el) {
  rootEl = el;
  render();
}

function render() {
  rootEl.innerHTML = `<div id="dashboard-day-switcher"></div>`;
  mountDaySwitcher(rootEl.querySelector("#dashboard-day-switcher"), () => renderStats());

  rootEl.insertAdjacentHTML(
    "beforeend",
    `
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-tile-label">الربح</div><div class="stat-tile-value" id="stat-profit"></div></div>
      <div class="stat-tile"><div class="stat-tile-label">الخسارة</div><div class="stat-tile-value" id="stat-loss"></div></div>
      <div class="stat-tile"><div class="stat-tile-label">صافي اليوم</div><div class="stat-tile-value" id="stat-net"></div></div>
      <div class="stat-tile"><div class="stat-tile-label">رأس المال الحالي</div><div class="stat-tile-value" id="stat-capital"></div></div>
    </div>
    <p class="card-sub" style="text-align:center;">رأس المال = تكلفة المنتجات الموجودة بالمخزون حاليًا (غير مرتبط باليوم المعروض)</p>
  `
  );

  renderStats();
}

async function renderStats() {
  const dateKey = getSelectedDate();
  const { profit, loss } = await getDaySummary(dateKey);
  const capital = await getCurrentCapital();
  const net = profit - loss;

  const profitEl = rootEl.querySelector("#stat-profit");
  const lossEl = rootEl.querySelector("#stat-loss");
  const netEl = rootEl.querySelector("#stat-net");
  const capitalEl = rootEl.querySelector("#stat-capital");
  if (!profitEl) return; // view was re-rendered/left before this resolved

  profitEl.textContent = profit.toLocaleString("en-US");
  profitEl.style.color = "var(--green)";
  lossEl.textContent = loss.toLocaleString("en-US");
  lossEl.style.color = loss > 0 ? "var(--red)" : "";
  netEl.textContent = net.toLocaleString("en-US");
  netEl.style.color = net >= 0 ? "var(--green)" : "var(--red)";
  capitalEl.textContent = capital.toLocaleString("en-US");
}
