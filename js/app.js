// app.js

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

// Popup and status section
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

const statusSection = document.getElementById("status-section");
const showStatusSectionBtn = document.getElementById("showStatusSection");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

let lastPrintId = null;
let lastAmount = 0;

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

// ====== Calculate button ======
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (amount === null) {
    calcResult.textContent = "Please fill in valid values for pages and copies.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ====== Upload + Create Print ======
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
      body: formData
    });

    if (!resp.ok) throw new Error("Failed to create print.");
    const data = await resp.json();

    if (!data || !data.print_id) throw new Error("Invalid response from server.");

    // ✅ Success: show popup
    lastPrintId = data.print_id;
    lastAmount = amount;
    printIdText.textContent = data.print_id;
    popup.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Network error - please check your connection and try again.");
  }
});

// ====== Popup Actions ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

closePopupBtn.addEventListener("click", async () => {
  popup.classList.add("hidden");

  if (!lastPrintId || !lastAmount) return;

  // 🧾 Create PayMongo checkout
  try {
    const resp = await fetch(`${API_BASE}/createCheckout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_id: lastPrintId, amount: lastAmount }),
    });

    const data = await resp.json();
    if (data?.checkout_url) {
      window.location.href = data.checkout_url; // redirect to PayMongo checkout
    } else {
      alert("Failed to start checkout session.");
    }
  } catch (err) {
    console.error("❌ Error starting checkout:", err);
    alert("Unable to start checkout. Please try again.");
  }
});

// ====== Check Print Status ======
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Enter a valid Print ID.");
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
    if (data.success) {
      statusResult.innerHTML = `
        <strong>Print Code:</strong> ${data.print_code}<br>
        <strong>Payment Status:</strong> ${data.payment_stat}<br>
        <strong>Print Status:</strong> ${data.print_status}<br>
        <strong>Notification:</strong> ${data.notification}
      `;
    } else {
      statusResult.textContent = data.error || "No record found.";
    }
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
