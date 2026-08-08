import { storage } from "../storage.js";
import { showToast } from "../toast.js";
import { compressPhoto } from "../photo.js";
import { addProduct } from "../db.js";

let rootEl = null;
let pendingBlob = null;
let pendingPreviewUrl = null;

export function mountAddProduct(el) {
  rootEl = el;
  pendingBlob = null;
  revokePreview();
  render();
}

function revokePreview() {
  if (pendingPreviewUrl) {
    URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = null;
  }
}

function render() {
  rootEl.innerHTML = `
    <div class="card" style="text-align:center;">
      <input type="file" accept="image/*" capture="environment" id="camera-input"
        style="position:absolute; opacity:0; width:1px; height:1px; overflow:hidden; pointer-events:none;" />
      ${
        pendingBlob
          ? `<img src="${pendingPreviewUrl}" class="add-preview" alt="" />`
          : `<div class="add-placeholder">📷</div>`
      }
      <label for="camera-input" class="btn btn-block" style="margin-top:12px;">
        ${pendingBlob ? "إعادة التصوير" : "تصوير المنتج"}
      </label>
    </div>

    ${
      pendingBlob
        ? `
      <div class="card">
        <form id="add-product-form">
          <input class="field" id="product-name-input" type="text" dir="auto" placeholder="اسم المنتج (اختياري)" style="margin-bottom:8px;" />
          <input class="field" id="product-cost-input" type="number" inputmode="decimal" placeholder="سعر الشراء" style="margin-bottom:8px;" />
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
    const blob = await compressPhoto(file);
    pendingBlob = blob;
    revokePreview();
    pendingPreviewUrl = URL.createObjectURL(blob);
    render();
  } catch (err) {
    showToast("تعذّر معالجة الصورة");
  }
}

async function onSubmit(e) {
  e.preventDefault();
  if (!pendingBlob) return;

  const nameInput = rootEl.querySelector("#product-name-input");
  const costInput = rootEl.querySelector("#product-cost-input");
  const name = nameInput.value.trim();
  const costPrice = Number(costInput.value);
  if (!costPrice || costPrice <= 0) {
    showToast("أدخل سعر شراء صحيح");
    return;
  }

  await addProduct({
    id: crypto.randomUUID(),
    photoBlob: pendingBlob,
    name: name || null,
    costPrice,
    purchaseDate: storage.todayKey(),
    status: "in-stock",
  });

  pendingBlob = null;
  revokePreview();
  showToast("تمت إضافة المنتج للمخزون");
  render();
}

export function unmountAddProduct() {
  revokePreview();
}
