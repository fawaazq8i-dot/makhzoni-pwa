import { showToast } from "../toast.js";
import { mountDaySwitcher, getSelectedDate, setSelectedDate, formatLabel, formatMonthLabel } from "./daySwitcher.js";
import { getProductsBySoldDate, getProductsByStatus, returnProduct } from "../db.js";

let rootEl = null;
let showAllView = false;
let allViewMode = "day"; // "day" | "month"
let expandedMonth = null;

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// Shared item card for any list of sold products (day view, expanded month).
function soldItemCardHtml(p) {
  const margin = p.sellPrice - p.costPrice;
  return `
    <div class="card stock-row">
      <div class="stock-row-top">
        <img class="stock-thumb" src="${p.photoDataUrl}" alt="" />
        <div class="item-info">
          <div class="item-title">${escapeHtml(p.name || "بدون اسم")}</div>
          <div class="price-row">
            <span class="price-label">سعر البيع:</span>
            <span class="price-box price-box-green">${p.sellPrice.toLocaleString("en-US")}</span>
          </div>
          <div class="item-sub">شراء: ${p.costPrice.toLocaleString("en-US")} ·
            <span style="color: var(--${margin >= 0 ? "green" : "red"});">${margin >= 0 ? "ربح" : "خسارة"} ${Math.abs(margin).toLocaleString("en-US")}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-sm btn-outline btn-block" data-action="return" data-id="${p.id}" style="margin-top:10px;">↩ إرجاع / استبدال (يعيده للمخزون)</button>
    </div>
  `;
}

function wireReturnButtons(container, onDone) {
  container.querySelectorAll('[data-action="return"]').forEach((btn) =>
    btn.addEventListener("click", async () => {
      await returnProduct(btn.dataset.id);
      showToast("تم إرجاع المنتج للمخزون");
      onDone();
    })
  );
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

// Groups a flat list of sold products by soldDate — total sold (revenue)
// and net profit per day, newest first.
function groupByDay(sold) {
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

function groupByMonth(sold) {
  const byMonth = {};
  for (const p of sold) {
    const monthKey = p.soldDate.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { revenue: 0, profit: 0, loss: 0, count: 0 };
    const m = byMonth[monthKey];
    m.revenue += p.sellPrice;
    m.count += 1;
    const diff = p.sellPrice - p.costPrice;
    if (diff > 0) m.profit += diff;
    else if (diff < 0) m.loss += -diff;
  }
  return Object.entries(byMonth)
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

// Overall (all-time, not tied to the displayed day) business insights:
// best-selling product by count, and the strongest/weakest months by net
// profit. Reuses groupByMonth, so it stays consistent with the الأشهر view.
async function getInsights() {
  const sold = await getProductsByStatus("sold");
  if (!sold.length) return null;

  const nameCounts = {};
  for (const p of sold) {
    const key = p.name || "بدون اسم";
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  }
  const [topProductName, topProductCount] = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0];

  const monthsByNet = groupByMonth(sold).sort((a, b) => b.profit - b.loss - (a.profit - a.loss));
  const best = monthsByNet[0];
  const worst = monthsByNet[monthsByNet.length - 1];

  return {
    topProductName,
    topProductCount,
    bestMonth: best.month,
    bestMonthNet: best.profit - best.loss,
    worstMonth: worst.month,
    worstMonthNet: worst.profit - worst.loss,
  };
}

export function mountDashboard(el) {
  rootEl = el;
  showAllView = false;
  expandedMonth = null;
  render();

  const allViewBtn = document.getElementById("btn-all-days");
  if (allViewBtn) {
    allViewBtn.onclick = () => {
      showAllView = !showAllView;
      render();
    };
  }
}

function render() {
  if (showAllView) {
    renderAllView();
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
    <div class="card-title" style="margin-top:16px;">إحصائيات عامة</div>
    <div class="card" id="insights-card"></div>
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

  await Promise.all([renderInsights(), renderSoldList(dateKey)]);
}

async function renderInsights() {
  const el = rootEl.querySelector("#insights-card");
  if (!el) return;

  const insights = await getInsights();
  if (!insights) {
    el.innerHTML = `<div class="empty-state">لا توجد بيانات كافية بعد</div>`;
    return;
  }

  el.innerHTML = `
    <div class="insight-row">
      <div class="insight-label">🏆 الأكثر مبيعًا</div>
      <div class="insight-value">${escapeHtml(insights.topProductName)} <span class="badge">${insights.topProductCount} مرة</span></div>
    </div>
    <div class="insight-row">
      <div class="insight-label">📈 أفضل شهر</div>
      <div class="insight-value">${formatMonthLabel(insights.bestMonth)} <span class="price-box price-box-green">${insights.bestMonthNet.toLocaleString("en-US")}</span></div>
    </div>
    <div class="insight-row">
      <div class="insight-label">📉 أضعف شهر</div>
      <div class="insight-value">${formatMonthLabel(insights.worstMonth)} <span style="color: var(--red); font-weight:700;">${insights.worstMonthNet.toLocaleString("en-US")}</span></div>
    </div>
  `;
}

async function renderSoldList(dateKey) {
  const listEl = rootEl.querySelector("#sold-list");
  if (!listEl) return;

  const sold = await getProductsBySoldDate(dateKey);
  if (!sold.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مبيعات لهذا اليوم</div>`;
    return;
  }

  listEl.innerHTML = sold.map(soldItemCardHtml).join("");
  wireReturnButtons(listEl, () => renderStats());
}

async function renderAllView() {
  rootEl.innerHTML = `
    <div class="all-days-header">
      <button class="btn btn-sm btn-outline" id="btn-back-to-day">‹ رجوع لليوم</button>
      <div class="all-days-title">السجل</div>
    </div>
    <div class="segmented" id="all-view-tabs">
      <button class="seg-btn ${allViewMode === "day" ? "active" : ""}" data-mode="day">الأيام</button>
      <button class="seg-btn ${allViewMode === "month" ? "active" : ""}" data-mode="month">الأشهر</button>
    </div>
    <div id="all-list"><div class="spinner"></div></div>
  `;

  rootEl.querySelector("#btn-back-to-day").addEventListener("click", () => {
    showAllView = false;
    render();
  });
  rootEl.querySelectorAll("#all-view-tabs .seg-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      allViewMode = btn.dataset.mode;
      expandedMonth = null;
      renderAllView();
    })
  );

  const sold = await getProductsByStatus("sold");
  const listEl = rootEl.querySelector("#all-list");
  if (!sold.length) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مبيعات مسجّلة بعد</div>`;
    return;
  }

  if (allViewMode === "month") {
    renderMonthRows(listEl, sold);
  } else {
    renderDayRows(listEl, sold);
  }
}

function renderDayRows(listEl, sold) {
  const days = groupByDay(sold);
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
      showAllView = false;
      render();
    })
  );
}

function renderMonthRows(listEl, sold) {
  const months = groupByMonth(sold);
  listEl.innerHTML = months
    .map((m) => {
      const isOpen = expandedMonth === m.month;
      const itemsHtml = isOpen
        ? sold
            .filter((p) => p.soldDate.slice(0, 7) === m.month)
            .sort((a, b) => b.soldDate.localeCompare(a.soldDate))
            .map(soldItemCardHtml)
            .join("")
        : "";
      return `
        <button class="card all-days-row" data-month="${m.month}">
          <div class="item-info">
            <div class="item-title">${formatMonthLabel(m.month)} ${isOpen ? "▾" : "▸"}</div>
            <div class="item-sub">${m.count} ${m.count === 1 ? "منتج" : "منتجات"}</div>
          </div>
          <div class="all-days-amounts">
            <div class="price-box price-box-green">المجموع: ${m.revenue.toLocaleString("en-US")}</div>
            <div class="item-sub" style="margin-top:4px; color: var(--${m.profit - m.loss >= 0 ? "green" : "red"});">صافي: ${(m.profit - m.loss).toLocaleString("en-US")}</div>
          </div>
        </button>
        ${isOpen ? `<div class="month-items">${itemsHtml}</div>` : ""}
      `;
    })
    .join("");

  listEl.querySelectorAll(".all-days-row[data-month]").forEach((row) =>
    row.addEventListener("click", () => {
      const month = row.dataset.month;
      expandedMonth = expandedMonth === month ? null : month;
      renderMonthRows(listEl, sold);
    })
  );
  wireReturnButtons(listEl, async () => {
    const freshSold = await getProductsByStatus("sold");
    renderMonthRows(listEl, freshSold);
  });
}

export function unmountDashboard() {}
