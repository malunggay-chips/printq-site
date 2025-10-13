// js/app.js

// Import configuration
import { API_BASE } from "./config.js";

// ===== ELEMENTS =====
const calcBtn = document.getElementById("calcBtn");
const uploadPayBtn = document.getElementById("uploadPayBtn");
const filesInput = document.getElementById("files");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const pagesInput = document.getElementById("pages");
const copiesInput = document.getElementById("copies");
const locationRow = document.getElementById("locationRow");
const locationInput = document.getElementById("location");
const calcResult = document.getElementById("calcResult");

// Popup
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

// Status
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// ===== HELPERS =====
function getSelectedValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function calculatePrice() {
  const pages = Number(pagesInput.value) || 0;
  const copies = Number(copiesInput.value) || 0;
  const color = getSelectedValue("color");
  const fulfill = getSelectedValue("fulfill");

  if (pages <= 0 || copies <= 0) return null;

  let per = color === "color" ? 10 : 5;
  let amount = pages * copies * per;
  if (fulfill === "delivery") amount += 20;
  return amount;
}

// ===== EVENT HANDLERS =====

// Delivery option toggle
document.querySelectorAll('input[name="fulfill"]').forEach((r) => {
  r.addEventListener("change", () => {
    const v = getSelectedValue("fulfill");
    if (v === "delivery") {
      locationRow.classList.remove("hidden");
      locationInput.required = true;
    } else {
      locationRow.classList.add("hidden");
      locationInput.required = false;
      locationInput.value = "";
    }
  });
});

// Calculate
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (amount === null) {
    calcResult.textContent = "Please enter valid pages and copies.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// Upload & Pay
uploadPayBtn.addEventListener("click", async () => {
  const files = filesInput.files;
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const pages = pagesInput.value;
  const copies = copiesInput.value;
  const color = getSelectedValue("color");
  const fulfill = getSelectedValue("fulfill");
  const location = locationInput.value.trim();

  if (!files.length || !name || !phone || !pages || !copies || !color || !fulfill) {
    alert("Please complete all fields and upload at least one file.");
    return;
  }

  const amount = calculatePrice();
  if (!amount) {
    alert("Please calculate the total first.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("pages", pages);
    formData.append("copies", copies);
    formData.append("color", color);
    formData.append("fulfill", fulfill);
    formData.append("location", location);
    formData.append("amount", amount);
    for (const file of files) formData.append("files", file);

    const resp = await fetch(`${API_BASE}/createPrint`, { method: "POST", body: formData });
    if (!resp.ok) throw new Error("Failed to create print");
    const data = await resp.json();
    const printId = data.print_id || "Print-0000";

    // Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // After closing popup → open PayMongo checkout
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");

      const checkoutResp = await fetch(`${API_BASE}/createCheckout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, print_id: printId, name }),
      });

      if (!checkoutResp.ok) {
        alert("Error creating PayMongo session.");
        return;
      }

      const checkoutData = await checkoutResp.json();
      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      } else {
        alert("No checkout URL returned.");
      }
    };
  } catch (err) {
    console.error(err);
    alert("Network error - please check your connection and try again.");
  }
});

// Copy Print ID
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// Check Status
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Please enter your Print ID.");
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printId }),
    });

    if (!resp.ok) throw new Error("Failed to fetch status.");
    const data = await resp.json();

    statusResult.innerHTML = `
      <p><b>Print Code:</b> ${data.print_code}</p>
      <p><b>Payment Status:</b> ${data.payment_stat}</p>
      <p><b>Print Status:</b> ${data.print_status}</p>
      <p><b>Notification:</b> ${data.notification}</p>
    `;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
