// app.js

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

// ====== API BASE ======
const API_BASE = "https://gtmchmkgjtsowgwrasye.supabase.co/functions/v1"; // Supabase Edge Functions URL

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

// Calculate button
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

  // Calculate total price
  const amount = calculatePrice();
  if (!amount) {
    alert("Please calculate price first.");
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

    for (const file of files) {
      formData.append("files", file);
    }

    // Create print record via Supabase Edge Function
    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) throw new Error("Failed to create print.");

    const data = await resp.json();
    const printId = data.print_id || data.id || "Print-0000";

    // Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert("There was a problem creating your print. Please try again.");
  }
});

// ====== POPUP ACTIONS ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

closePopupBtn.addEventListener("click", () => {
  popup.classList.add("hidden");
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
