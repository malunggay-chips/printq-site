// js/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elements
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

const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// Helpers
function getSelectedValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
function calculatePrice() {
  const pages = Number(pagesInput.value);
  const copies = Number(copiesInput.value);
  const color = getSelectedValue("color");
  const fulfill = getSelectedValue("fulfill");
  if (!pages || !copies || !color) return null;
  let per = color === "color" ? 10 : 5;
  let total = pages * copies * per;
  if (fulfill === "delivery") total += 20;
  return total;
}

// Show/hide delivery location input
document.querySelectorAll('input[name="fulfill"]').forEach(r => {
  r.addEventListener("change", () => {
    if (getSelectedValue("fulfill") === "delivery") {
      locationRow.classList.remove("hidden");
      locationInput.required = true;
    } else {
      locationRow.classList.add("hidden");
      locationInput.required = false;
      locationInput.value = "";
    }
  });
});

// Calculate button
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (!amount) {
    calcResult.textContent = "Please fill in valid details.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// Upload & Pay button
uploadPayBtn.addEventListener("click", async () => {
  const files = filesInput.files;
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const pages = pagesInput.value;
  const copies = copiesInput.value;
  const color = getSelectedValue("color");
  const fulfill = getSelectedValue("fulfill");
  const location = locationInput.value.trim();
  const amount = calculatePrice();

  if (!name || !phone || !pages || !copies || !color || !fulfill || !files.length || !amount) {
    alert("Please fill in all required fields and upload files.");
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
    for (const f of files) formData.append("files", f);

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

    closePopupBtn.onclick = () => {
      popup.classList.add("hidden");
      location.href = `${API_BASE}/createCheckout?print_id=${encodeURIComponent(printId)}`;
    };
  } catch (err) {
    console.error("Upload & Pay error:", err);
    alert("Network error — please check your connection and try again.");
  }
});

// Copy button
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// Status checker
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Enter your Print ID.");
    return;
  }
  statusResult.textContent = "Checking status...";
  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_id: printId }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.print_code) {
      statusResult.textContent = "No record found for this Print ID.";
      return;
    }
    statusResult.innerHTML = `
      <strong>Print Code:</strong> ${data.print_code}<br>
      <strong>Payment:</strong> ${data.payment_stat}<br>
      <strong>Print Status:</strong> ${data.print_status}
    `;
  } catch (err) {
    console.error("Status check error:", err);
    statusResult.textContent = "Error checking status.";
  }
});
