// ===============================
// app.js — Updated October 2025
// ===============================

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

// Status section
const statusSection = document.getElementById("status-section");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// ====== API BASE ======
const API_BASE = "https://gtmchmkgjtsowgwrasye.supabase.co/functions/v1"; // Your Supabase Edge Function base URL

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

// Toggle delivery location field
document.querySelectorAll('input[name="fulfill"]').forEach((r) => {
  r.addEventListener("change", (e) => {
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

// Calculate total price
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (amount === null) {
    calcResult.textContent = "Please fill in valid values for pages and copies.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ====== MAIN UPLOAD + CREATE PRINT ======
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
    alert("Please calculate the price first.");
    return;
  }

  try {
    // Prepare FormData
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

    // Send request to Supabase Edge Function
    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData
    });

    // Safely parse JSON
    const data = await resp.json().catch(() => ({}));
    console.log("🧠 Server Response:", data);

    if (resp.ok && data?.success && data?.print_id) {
      // ✅ Show popup with print ID
      showPrintIdPopup(data.print_id);
    } else {
      console.error("⚠️ Unexpected response:", data);
      alert("There was a problem creating your print. Please try again.");
    }
  } catch (error) {
    console.error("❌ Network or parsing error:", error);
    alert("Network error — please check your connection and try again.");
  }
});

// ====== CHECK STATUS SECTION ======
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
    statusResult.textContent = `Status: ${data.status || "Unknown"}`;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});

// ====== POPUP CREATOR ======
function showPrintIdPopup(printId) {
  const popup = document.createElement("div");
  popup.classList.add("popup-overlay");
  popup.innerHTML = `
    <div class="popup-box">
      <h2>✅ Print Created!</h2>
      <p>Your unique print ID:</p>
      <div class="print-id-box">
        <span id="printIdText">${printId}</span>
        <button id="copyPrintId">Copy</button>
      </div>
      <button id="closePopup">Close</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Copy button
  document.getElementById("copyPrintId").addEventListener("click", () => {
    navigator.clipboard.writeText(printId);
    alert("Print ID copied!");
  });

  // Close button
  document.getElementById("closePopup").addEventListener("click", () => {
    popup.remove();

    // 💳 (NEXT UPDATE) Redirect to PayMongo checkout here
    // Example placeholder:
    // window.open(checkoutUrlFromServer, "_blank");
  });
}
