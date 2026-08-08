import { storage } from "../storage.js";
import { showToast } from "../toast.js";
import { compressPhoto } from "../photo.js";
import { addProduct, getLocations } from "../db.js";

let rootEl = null;
let pendingPhotoDataUrl = null;
let locations = [];

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function mountAddProduct(el) {
  rootEl = el;
  pendingPhotoDataUrl = null;
  render();
  getLocations().then((locs) => {
    locations = locs;
    render();
  });
}

function render() {
  rootEl.innerHTML = `
    <div class="card" style="text-align:center;">
      <input type="file" accept="image/*" capture="environment" id="camera-input"
        style="position:absolute; opacity:0; width:1px; height:1px; overflow:hidden; pointer-events:none;" />
      ${
        pendingPhotoDataUrl
          ? `<img src="${pendingPhotoDataUrl}" class="add-preview" alt="" />`
          : `<div class="add-placeholder">📷</div>`
      }
      <label for="camera-input" class="btn btn-block" style="margin-top:12px;">
        ${pendingPhotoDataUrl ? "إعادة التصوير" : "تصوير المنتج"}
      </label>
    </div>

    ${
      pendingPhotoDataUrl
        ? `
      <div class="card">
        <form id="add-product-form">
          <input class="field" id="product-name-input" type="text" dir="auto" placeholder="اسم المنتج (اختياري)" style="margin-bottom:8px;" />
          <input class="field" id="product-cost-input" type="number" inputmode="decimal" placeholder="سعر الشراء" style="margin-bottom:8px;" />
          ${
            locations.length
              ? `
            <select class="field" id="product-location-select" style="margin-bottom:8px;">
              <option value="">بدون خانة</option>
              ${locations.map((loc) => `<option value="${loc.id}">${escapeHtml(loc.name)}</option>`).join("")}
            </select>
          `
              : ""
          }
          <button class="btn btn-block" type="submit">حفظ بالمخزون</button>
        </form>
      </div>
    `
        : `<p class="card-sub" style="text-align:center;">صوّر المنتج أولًا ثم أدخل سعر الشراء</p>`
    }
  `;

  const input = rootEl.querySelector("#camera-input");
  input.addEventListener("change", onFileChange);

  const form = rootEl.querySelector("#add-product-form");
  if (form) form.addEventListener("submit", onSubmit);
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;

  try {
    pendingPhotoDataUrl = await compressPhoto(file);
    render();
  } catch (err) {
    showToast("تعذّر معالجة الصورة");
  }
}

async function onSubmit(e) {
  e.preventDefault();
  if (!pendingPhotoDataUrl) return;

  const nameInput = rootEl.querySelector("#product-name-input");
  const costInput = rootEl.querySelector("#product-cost-input");
  const locationSelect = rootEl.querySelector("#product-location-select");
  const name = nameInput.value.trim();
  const costPrice = Number(costInput.value);
  if (!costPrice || costPrice <= 0) {
    showToast("أدخل سعر شراء صحيح");
    return;
  }

  await addProduct({
    id: crypto.randomUUID(),
    photoDataUrl: pendingPhotoDataUrl,
    name: name || null,
    costPrice,
    purchaseDate: storage.todayKey(),
    status: "in-stock",
    locationId: (locationSelect && locationSelect.value) || null,
  });

  pendingPhotoDataUrl = null;
  showToast("تمت إضافة المنتج للمخزون");
  render();
}

export function unmountAddProduct() {
  pendingPhotoDataUrl = null;
}
