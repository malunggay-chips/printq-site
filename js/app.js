// ====== IMPORT CONFIG ======
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

// Popup elements
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

// Status checker
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

  if (pages <= 0 || copies <= 0 || !color || !fulfill) return null;

  let pricePerPage = color === "color" ? 10 : 5;
  let total = pages * copies * pricePerPage;
  if (fulfill === "delivery") total += 20;

  return total;
}

// ====== EVENT: Fulfillment Toggle ======
document.querySelectorAll('input[name="fulfill"]').forEach((r) => {
  r.addEventListener("change", () => {
    const val = getSelectedValue("fulfill");
    if (val === "delivery") {
      locationRow.classList.remove("hidden");
      locationInput.required = true;
    } else {
      locationRow.classList.add("hidden");
      locationInput.required = false;
      locationInput.value = "";
    }
  });
});

// ====== EVENT: Calculate ======
calcBtn.addEventListener("click", () => {
  const total = calculatePrice();
  if (total === null) {
    calcResult.textContent = "⚠️ Please fill in all required fields first.";
    return;
  }
  calcResult.textContent = `💰 Total: ₱${total}`;
});

// ====== EVENT: Upload & Pay ======
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
    alert("⚠️ Please complete all fields and upload at least one file.");
    return;
  }

  const amount = calculatePrice();
  if (!amount) {
    alert("⚠️ Please calculate total before proceeding.");
    return;
  }

  try {
    // Prepare form data
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

    // Step 1: Create Print Job
    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) throw new Error("Failed to create print job.");
    const data = await resp.json();
    const printId = data.print_id || data.id || "Print-0000";

    // Show popup with print ID
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // Step 2: Wait for popup close before starting payment
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");
      alert("🔄 Starting PayMongo checkout...");

      try {
        const resp2 = await fetch(`${API_BASE}/createCheckout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ print_id: printId, name, amount }),
        });

        if (!resp2.ok) throw new Error("Failed to start checkout session.");

        const { url } = await resp2.json();
        if (!url) throw new Error("Missing PayMongo URL.");

        window.location.href = url; // Redirect to PayMongo checkout
      } catch (e) {
        console.error("💥 Payment error:", e);
        alert("Error starting payment. Try again later.");
      }
    };
  } catch (err) {
    console.error("❌ Network error:", err);
    alert("Network error - please check your connection and try again.");
  }
});

// ====== EVENT: Copy Print ID ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("✅ Print ID copied to clipboard!");
});

// ====== EVENT: Check Print Status ======
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Enter your Print ID first!");
    return;
  }

  statusResult.textContent = "🔄 Checking status...";

  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_id: printId }),
    });

    if (!resp.ok) throw new Error("Failed to check status.");

    const data = await resp.json();

    if (data.error) throw new Error(data.error);

    statusResult.innerHTML = `
      🧾 <strong>Print Code:</strong> ${data.print_code || "N/A"}<br>
      💰 <strong>Payment Status:</strong> ${data.payment_stat || "Unknown"}<br>
      🖨️ <strong>Print Status:</strong> ${data.print_status || "Unknown"}<br>
      📦 <strong>Notification:</strong> ${data.notification || "N/A"}
    `;
  } catch (err) {
    console.error("❌ Status check failed:", err);
    statusResult.textContent = "Error checking status.";
  }
});
