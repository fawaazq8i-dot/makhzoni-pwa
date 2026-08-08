import { storage } from "../storage.js";
import { showToast } from "../toast.js";
import { getProductsByStatus, updateProduct, deleteProduct } from "../db.js";

let rootEl = null;
let sellingId = null; // id of the item currently showing the sell-price form

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function mountStock(el) {
  rootEl = el;
  sellingId = null;
  render();
}

async function render() {
  rootEl.innerHTML = `<div class="spinner"></div>`;

  const items = await getProductsByStatus("in-stock");
  items.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  if (!items.length) {
    rootEl.innerHTML = `<div class="empty-state">لا توجد منتجات بالمخزون — صوّر أول منتج لك</div>`;
    return;
  }

  rootEl.innerHTML = items.map((item) => stockRowHtml(item)).join("");

  rootEl.querySelectorAll('[data-action="mark-sold"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      sellingId = btn.dataset.id;
      render();
    })
  );
  rootEl.querySelectorAll('[data-action="cancel-sell"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      sellingId = null;
      render();
    })
  );
  rootEl.querySelectorAll('[data-action="confirm-sell"]').forEach((btn) =>
    btn.addEventListener("click", () => confirmSell(btn.dataset.id))
  );
  rootEl.querySelectorAll('[data-action="delete"]').forEach((btn) =>
    btn.addEventListener("click", () => onDelete(btn.dataset.id))
  );
}

function stockRowHtml(item) {
  const isSelling = sellingId === item.id;

  return `
    <div class="card stock-row">
      <div class="stock-row-top">
        <img class="stock-thumb" src="${item.photoDataUrl}" alt="" />
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.name || "بدون اسم")}</div>
          <div class="item-sub">سعر الشراء: ${item.costPrice.toLocaleString("en-US")} · ${item.purchaseDate}</div>
        </div>
        <button class="item-delete" data-action="delete" data-id="${item.id}">✕</button>
      </div>
      ${
        isSelling
          ? `
        <div class="sell-form">
          <input class="field" type="number" inputmode="decimal" id="sell-price-${item.id}" placeholder="سعر البيع" />
          <input class="field" type="date" id="sell-date-${item.id}" value="${storage.todayKey()}" />
          <div class="field-row" style="margin-top:8px;">
            <button class="btn btn-block" data-action="confirm-sell" data-id="${item.id}">تأكيد البيع</button>
            <button class="btn btn-outline btn-block" data-action="cancel-sell" data-id="${item.id}">إلغاء</button>
          </div>
        </div>
      `
          : `<button class="btn btn-sm btn-block" data-action="mark-sold" data-id="${item.id}" style="margin-top:10px;">تحديد كمباع</button>`
      }
    </div>
  `;
}

async function confirmSell(id) {
  const priceInput = rootEl.querySelector(`#sell-price-${id}`);
  const dateInput = rootEl.querySelector(`#sell-date-${id}`);
  const sellPrice = Number(priceInput.value);
  const soldDate = dateInput.value || storage.todayKey();
  if (!sellPrice || sellPrice <= 0) {
    showToast("أدخل سعر بيع صحيح");
    return;
  }

  await updateProduct(id, { status: "sold", sellPrice, soldDate });
  sellingId = null;
  showToast("تم تحديد المنتج كمباع");
  render();
}

async function onDelete(id) {
  await deleteProduct(id);
  showToast("تم الحذف");
  render();
}

export function unmountStock() {}
