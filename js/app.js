// js/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYMONGO_SECRET, API_BASE } from "./config.js";

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

const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// ====== SUPABASE CLIENT ======
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== HELPERS ======
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

// ====== DELIVERY TOGGLE ======
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

// ====== CALCULATE BUTTON ======
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (!amount) {
    calcResult.textContent = "Please fill in valid details.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ====== UPLOAD + PAY ======
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
    alert("Please fill out all fields and upload your files.");
    return;
  }

  try {
    // 1️⃣ Create a print record
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

    const resp = await fetch(`${API_BASE}/createPrint`, { method: "POST", body: formData });
    if (!resp.ok) throw new Error("Failed to create print");
    const data = await resp.json();
    const printId = data.print_id || data.printId;

    // 2️⃣ Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // 3️⃣ After closing popup → start PayMongo checkout
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");
      await startPaymongoCheckout(printId, amount, name);
    };
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Network error — please check your connection and try again.");
  }
});

// ====== PAYMONGO CHECKOUT ======
async function startPaymongoCheckout(printId, amount, name) {
  try {
    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(PAYMONGO_SECRET + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `Print Order ${printId}`,
                quantity: 1,
                currency: "PHP",
                amount: amount * 100, // centavos
                description: `${printId} - ${name}`,
              },
            ],
            payment_method_types: ["gcash", "paymaya"],
            success_url: window.location.origin,
            cancel_url: window.location.origin,
          },
        },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(json.errors?.[0]?.detail || "Error starting payment");

    // Redirect to PayMongo checkout
    window.location.href = json.data.attributes.checkout_url;
  } catch (err) {
    console.error("❌ Error starting payment:", err);
    alert("Error starting payment. Try again later.");
  }
}

// ====== COPY PRINT ID ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// ====== STATUS CHECKER ======
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) return alert("Please enter a valid Print ID.");

  statusResult.textContent = "Checking status...";

  try {
    const { data, error } = await supabase
      .from("prints")
      .select("name, created_at, payment_stat, print_status")
      .eq("print_id", printId)
      .maybeSingle();

    if (error || !data) {
      statusResult.textContent = "No record found for this Print ID.";
      return;
    }

    const name = data.name || "Unknown";
    const createdAt = new Date(data.created_at).toLocaleString("en-PH", {
      hour12: false,
    });
    const code = `${name}-${createdAt.replace(/[:\s/]/g, "")}`;
    const pay = data.payment_stat || "Unpaid";
    const stat = data.print_status || "Pending";

    statusResult.innerHTML = `
      🧾 <b>Print Code:</b> ${code}<br>
      💰 <b>Payment:</b> ${pay}<br>
      🖨️ <b>Status:</b> ${stat}
    `;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
