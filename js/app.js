// js/app.js
import { API_BASE } from "./config.js";

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

const statusPrintId = document.getElementById("statusPrintId");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusResult = document.getElementById("statusResult");

// Helpers
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

// Show/hide location
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

// Calculate
calcBtn.addEventListener("click", () => {
  const amt = calculatePrice();
  if (amt === null) {
    calcResult.textContent = "Please enter valid pages & copies.";
    return;
  }
  calcResult.textContent = `Total: ₱${amt}`;
});

// Upload & Pay
uploadPayBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const pages = pagesInput.value;
  const copies = copiesInput.value;
  const color = getSelectedValue("color");
  const fulfill = getSelectedValue("fulfill");
  const location = locationInput.value.trim();

  if (!filesInput.files.length || !name || !phone || !pages || !copies || !color || !fulfill) {
    alert("Please complete all fields and upload at least one file.");
    return;
  }

  const amount = calculatePrice();
  if (!amount) {
    alert("Calculate the price first.");
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
    for (const f of filesInput.files) {
      formData.append("files", f);
    }

    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "createPrint failed");

    const pid = data.print_id || "Unknown";
    printIdText.textContent = pid;
    popup.classList.remove("hidden");

    // after popup, redirect to PayMongo
    closePopupBtn.addEventListener("click", async () => {
      popup.classList.add("hidden");

      try {
        const coResp = await fetch(`${API_BASE}/createCheckout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ print_id: pid, amount, name }),
        });
        const coData = await coResp.json();
        if (!coResp.ok) throw new Error(coData.error || "createCheckout failed");
        window.location.href = coData.checkout_url;
      } catch (err) {
        console.error("❌ checkout error:", err);
        alert("Error starting payment. Try again later.");
      }
    });

  } catch (err) {
    console.error("❌ upload & print error:", err);
    alert("Network error — please check your connection and try again.");
  }
});

// Copy Print ID
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Copied Print ID!");
});

// Check status
checkStatusBtn.addEventListener("click", async () => {
  const pid = statusPrintId.value.trim();
  if (!pid) {
    alert("Enter Print ID.");
    return;
  }
  statusResult.textContent = "Checking status...";

  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_id: pid }),
    });
    const stData = await resp.json();
    if (!resp.ok) throw new Error(stData.error || "Status check failed");

    statusResult.innerHTML = `
      <p><strong>Print Code:</strong> ${stData.print_code}</p>
      <p><strong>Payment Status:</strong> ${stData.payment_stat}</p>
      <p><strong>Print Status:</strong> ${stData.print_status}</p>
      <p><strong>Notification:</strong> ${stData.notification}</p>
    `;
  } catch (err) {
    console.error("❌ status error:", err);
    statusResult.textContent = "Error checking status.";
  }
});
