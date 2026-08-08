import { showToast } from "../toast.js";
import { mountDaySwitcher, getSelectedDate } from "./daySwitcher.js";
import { getProductsBySoldDate, getProductsByStatus, returnProduct } from "../db.js";

let rootEl = null;
let activeObjectUrls = [];

function revokeAll() {
  activeObjectUrls.forEach((u) => URL.revokeObjectURL(u));
  activeObjectUrls = [];
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

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
    <div class="card-title" style="margin-top:16px;">مبيعات هذا اليوم</div>
    <div id="sold-list"></div>
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

  await renderSoldList(dateKey);
}

async function renderSoldList(dateKey) {
  revokeAll();
  const listEl = rootEl.querySelector("#sold-list");
  if (!listEl) return;

  const sold = await getProductsBySoldDate(dateKey);
  if (!sold.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مبيعات لهذا اليوم</div>`;
    return;
  }

  listEl.innerHTML = sold
    .map((p) => {
      const url = URL.createObjectURL(p.photoBlob);
      activeObjectUrls.push(url);
      const margin = p.sellPrice - p.costPrice;
      return `
        <div class="card stock-row">
          <div class="stock-row-top">
            <img class="stock-thumb" src="${url}" alt="" />
            <div class="item-info">
              <div class="item-title">${escapeHtml(p.name || "بدون اسم")}</div>
              <div class="item-sub">شراء: ${p.costPrice.toLocaleString("en-US")} · بيع: ${p.sellPrice.toLocaleString("en-US")}
                · <span style="color: var(--${margin >= 0 ? "green" : "red"});">${margin >= 0 ? "ربح" : "خسارة"} ${Math.abs(margin).toLocaleString("en-US")}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-outline btn-block" data-action="return" data-id="${p.id}" style="margin-top:10px;">↩ إرجاع / استبدال (يعيده للمخزون)</button>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll('[data-action="return"]').forEach((btn) =>
    btn.addEventListener("click", () => onReturn(btn.dataset.id, dateKey))
  );
}

async function onReturn(id, dateKey) {
  await returnProduct(id);
  showToast("تم إرجاع المنتج للمخزون");
  renderStats();
}

export function unmountDashboard() {
  revokeAll();
}
