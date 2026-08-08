import { storage } from "../storage.js";
import { showToast } from "../toast.js";
import {
  getProductsByStatus,
  updateProduct,
  deleteProduct,
  getLocations,
  addLocation,
  deleteLocation,
} from "../db.js";

let rootEl = null;
let sellingId = null; // id of the item currently showing the sell-price form
let locations = [];
let items = [];

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

  [locations, items] = await Promise.all([getLocations(), getProductsByStatus("in-stock")]);
  items.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

  rootEl.innerHTML = `
    <div id="locations-manager"></div>
    <div id="stock-groups"></div>
  `;

  renderLocationsManager();
  renderStockGroups();
}

function renderLocationsManager() {
  const el = rootEl.querySelector("#locations-manager");
  el.innerHTML = `
    <div class="card">
      <div class="card-title">الخانات</div>
      <form id="add-location-form" class="field-row">
        <input class="field" id="new-location-name" type="text" dir="auto" placeholder="اسم خانة جديدة (مثلاً: رف 1)" />
        <button class="btn" type="submit">إضافة</button>
      </form>
      ${
        locations.length
          ? `<div style="margin-top:10px;">${locations
              .map((loc) => {
                const count = items.filter((p) => p.locationId === loc.id).length;
                return `
                  <div class="item-row">
                    <div class="item-info">
                      <div class="item-title">${escapeHtml(loc.name)}</div>
                      <div class="item-sub">${count} ${count === 1 ? "منتج" : "منتجات"}</div>
                    </div>
                    <button class="item-delete" data-action="delete-location" data-id="${loc.id}">✕</button>
                  </div>
                `;
              })
              .join("")}</div>`
          : `<p class="card-sub" style="margin-top:8px;">أضف خانات لتنظيم مخزونك (رفوف، غرف، صناديق...) وحدد لكل منتج مكانه</p>`
      }
    </div>
  `;

  el.querySelector("#add-location-form").addEventListener("submit", onAddLocation);
  el.querySelectorAll('[data-action="delete-location"]').forEach((btn) =>
    btn.addEventListener("click", () => onDeleteLocation(btn.dataset.id))
  );
}

async function onAddLocation(e) {
  e.preventDefault();
  const input = rootEl.querySelector("#new-location-name");
  const name = input.value.trim();
  if (!name) {
    showToast("أدخل اسم الخانة");
    return;
  }
  await addLocation(name);
  showToast("تمت إضافة الخانة");
  render();
}

async function onDeleteLocation(id) {
  await deleteLocation(id);
  showToast("تم حذف الخانة، ورجعت منتجاتها بدون خانة");
  render();
}

function renderStockGroups() {
  const el = rootEl.querySelector("#stock-groups");

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">لا توجد منتجات بالمخزون — صوّر أول منتج لك</div>`;
    return;
  }

  // With no خانات defined yet, keep the flat list — no point showing a
  // single "بدون خانة" header when there's nothing to group against.
  if (!locations.length) {
    el.innerHTML = items.map((item) => stockRowHtml(item)).join("");
    wireRowEvents(el);
    return;
  }

  const unassigned = items.filter((p) => !p.locationId || !locations.some((l) => l.id === p.locationId));
  const groups = locations.map((loc) => ({ loc, list: items.filter((p) => p.locationId === loc.id) }));

  el.innerHTML =
    groups
      .map(
        (g) => `
      <div class="stock-section-title"><span>${escapeHtml(g.loc.name)}</span><span class="badge">${g.list.length}</span></div>
      ${g.list.length ? g.list.map((item) => stockRowHtml(item)).join("") : `<div class="empty-state">لا توجد منتجات بهذه الخانة</div>`}
    `
      )
      .join("") +
    `
      <div class="stock-section-title"><span>بدون خانة</span><span class="badge">${unassigned.length}</span></div>
      ${unassigned.length ? unassigned.map((item) => stockRowHtml(item)).join("") : `<div class="empty-state">كل المنتجات موزّعة على خانات</div>`}
    `;

  wireRowEvents(el);
}

function wireRowEvents(el) {
  el.querySelectorAll('[data-action="mark-sold"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      sellingId = btn.dataset.id;
      renderStockGroups();
    })
  );
  el.querySelectorAll('[data-action="cancel-sell"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      sellingId = null;
      renderStockGroups();
    })
  );
  el.querySelectorAll('[data-action="confirm-sell"]').forEach((btn) =>
    btn.addEventListener("click", () => confirmSell(btn.dataset.id))
  );
  el.querySelectorAll('[data-action="delete"]').forEach((btn) =>
    btn.addEventListener("click", () => onDelete(btn.dataset.id))
  );
  el.querySelectorAll('[data-action="assign-location"]').forEach((select) =>
    select.addEventListener("change", () => onAssignLocation(select.dataset.id, select.value))
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
          <div class="price-row">
            <span class="price-label">سعر الشراء:</span>
            <span class="price-box price-box-green">${item.costPrice.toLocaleString("en-US")}</span>
          </div>
          <div class="item-sub">${item.purchaseDate}</div>
        </div>
        <button class="item-delete" data-action="delete" data-id="${item.id}">✕</button>
      </div>
      ${
        locations.length
          ? `
        <div class="location-assign-row">
          <span class="price-label">الخانة:</span>
          <select class="field" data-action="assign-location" data-id="${item.id}">
            <option value="">بدون خانة</option>
            ${locations
              .map(
                (loc) =>
                  `<option value="${loc.id}" ${item.locationId === loc.id ? "selected" : ""}>${escapeHtml(loc.name)}</option>`
              )
              .join("")}
          </select>
        </div>
      `
          : ""
      }
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

async function onAssignLocation(id, locationId) {
  await updateProduct(id, { locationId: locationId || null });
  showToast("تم تحديث الخانة");
  render();
}

async function onDelete(id) {
  await deleteProduct(id);
  showToast("تم الحذف");
  render();
}

export function unmountStock() {}
