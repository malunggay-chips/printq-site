// app.js — FINAL INTEGRATED VERSION (2025)
// Handles upload → createPrint → PayMongo checkout → status checking.

import { API_BASE } from "./config.js";

// ====== ELEMENTS ======
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

// Status section
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// ====== HELPERS ======
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

// ====== EVENT LISTENERS ======
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

// ====== CALCULATE PRICE ======
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (amount === null) {
    calcResult.textContent = "Please fill in valid values for pages and copies.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ====== MAIN: Upload + Create Print ======
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
    alert("Please fill out all required fields and upload at least one file.");
    return;
  }

  const amount = calculatePrice();
  if (!amount) {
    alert("Please calculate price first.");
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

    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    if (!resp.ok || !data.print_id) {
      throw new Error(data.error || "Failed to create print");
    }

    const printId = data.print_id;
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // Store print details temporarily for checkout
    popup.dataset.printId = printId;
    popup.dataset.amount = amount;
    popup.dataset.name = name;
    popup.dataset.phone = phone;

  } catch (err) {
    console.error(err);
    alert("Network error - please check your connection and try again.");
  }
});

// ====== POPUP BUTTONS ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

closePopupBtn.addEventListener("click", async () => {
  popup.classList.add("hidden");

  // After closing popup → Start PayMongo Checkout
  const printId = popup.dataset.printId;
  const amount = popup.dataset.amount;
  const name = popup.dataset.name;
  const phone = popup.dataset.phone;

  if (!printId || !amount) return;

  try {
    const resp = await fetch(`${API_BASE}/createCheckout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_id: printId, amount, name, phone }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.checkout_url) {
      throw new Error(data.error || "Error starting payment");
    }

    // Redirect to PayMongo checkout (test mode)
    window.location.href = data.checkout_url;
  } catch (err) {
    console.error(err);
    alert("Error starting payment. Try again later.");
  }
});

// ====== STATUS CHECKER ======
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Enter a valid Print ID.");
    return;
  }

  statusResult.textContent = "Checking status...";

  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printId }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || "Failed to check status");
    }

    const { print_code, payment_stat, print_status } = data;
    statusResult.textContent = `🧾 ${print_code}\n💰 Payment: ${payment_stat}\n🖨️ Print Status: ${print_status}`;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
