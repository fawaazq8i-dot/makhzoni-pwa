let hideTimer = null;

export function showToast(message, ms = 2200) {
  const el = document.getElementById("toast-msg");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove("show"), ms);
}
