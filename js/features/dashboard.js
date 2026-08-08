import { showToast } from "../toast.js";
import { mountDaySwitcher, getSelectedDate, setSelectedDate, formatLabel } from "./daySwitcher.js";
import { getProductsBySoldDate, getProductsByStatus, returnProduct } from "../db.js";

let rootEl = null;
let showAllDays = false;

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

// Groups every sold product by soldDate for the "كل الأيام" list — total
// sold (revenue) and net profit per day, newest first.
async function getAllDaysSummary() {
  const sold = await getProductsByStatus("sold");
  const byDate = {};
  for (const p of sold) {
    if (!byDate[p.soldDate]) byDate[p.soldDate] = { revenue: 0, profit: 0, loss: 0, count: 0 };
    const entry = byDate[p.soldDate];
    entry.revenue += p.sellPrice;
    entry.count += 1;
    const diff = p.sellPrice - p.costPrice;
    if (diff > 0) entry.profit += diff;
    else if (diff < 0) entry.loss += -diff;
  }
  return Object.entries(byDate)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function mountDashboard(el) {
  rootEl = el;
  showAllDays = false;
  render();

  const allDaysBtn = document.getElementById("btn-all-days");
  if (allDaysBtn) {
    allDaysBtn.onclick = () => {
      showAllDays = !showAllDays;
      render();
    };
  }
}

function render() {
  if (showAllDays) {
    renderAllDaysView();
    return;
  }

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
  const listEl = rootEl.querySelector("#sold-list");
  if (!listEl) return;

  const sold = await getProductsBySoldDate(dateKey);
  if (!sold.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مبيعات لهذا اليوم</div>`;
    return;
  }

  listEl.innerHTML = sold
    .map((p) => {
      const margin = p.sellPrice - p.costPrice;
      return `
        <div class="card stock-row">
          <div class="stock-row-top">
            <img class="stock-thumb" src="${p.photoDataUrl}" alt="" />
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

async function renderAllDaysView() {
  rootEl.innerHTML = `
    <div class="all-days-header">
      <button class="btn btn-sm btn-outline" id="btn-back-to-day">‹ رجوع لليوم</button>
      <div class="all-days-title">كل الأيام</div>
    </div>
    <div id="all-days-list"><div class="spinner"></div></div>
  `;
  rootEl.querySelector("#btn-back-to-day").addEventListener("click", () => {
    showAllDays = false;
    render();
  });

  const days = await getAllDaysSummary();
  const listEl = rootEl.querySelector("#all-days-list");
  if (!days.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مبيعات مسجّلة بعد</div>`;
    return;
  }

  listEl.innerHTML = days
    .map(
      (d) => `
    <button class="card all-days-row" data-date="${d.date}">
      <div class="item-info">
        <div class="item-title">${formatLabel(d.date)}</div>
        <div class="item-sub">${d.count} ${d.count === 1 ? "منتج" : "منتجات"}</div>
      </div>
      <div class="all-days-amounts">
        <div class="price-box price-box-green">المجموع: ${d.revenue.toLocaleString("en-US")}</div>
        <div class="item-sub" style="margin-top:4px; color: var(--${d.profit - d.loss >= 0 ? "green" : "red"});">صافي: ${(d.profit - d.loss).toLocaleString("en-US")}</div>
      </div>
    </button>
  `
    )
    .join("");

  listEl.querySelectorAll(".all-days-row").forEach((row) =>
    row.addEventListener("click", () => {
      setSelectedDate(row.dataset.date);
      showAllDays = false;
      render();
    })
  );
}

export function unmountDashboard() {}
