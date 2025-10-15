// js/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYMONGO_SECRET, API_BASE } from "./config.js";

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

const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

// ===== PRICE CALCULATION =====
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

// ===== FULFILLMENT HANDLER =====
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

// ===== CALCULATE BUTTON =====
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (!amount) {
    calcResult.textContent = "Please fill in valid details.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ===== UPLOAD + PAY FLOW =====
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
    // 1️⃣ Create print record
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
    if (!resp.ok) throw new Error("Failed to create print");

    const data = await resp.json();
    const printId = data.print_id || data.printId;

    // 2️⃣ Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // 3️⃣ When popup closed → start payment
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");
      await startPaymongoCheckout(printId, amount);
    };
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Network error — please check your connection and try again.");
  }
});

// ===== PAYMONGO CHECKOUT =====
async function startPaymongoCheckout(printId, amount) {
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
                amount: amount * 100,
              },
            ],
            payment_method_types: ["gcash", "paymaya"],
            success_url: window.location.origin,
            cancel_url: window.location.origin,
            metadata: {
              print_id: printId,
            },
          },
        },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.data) {
      console.error("PayMongo Error:", json);
      throw new Error(json.errors?.[0]?.detail || "Error starting payment");
    }

    // Redirect to PayMongo checkout page
    window.location.href = json.data.attributes.checkout_url;
  } catch (err) {
    console.error("❌ Error starting payment:", err);
    alert("Error starting payment. Try again later.");
  }
}

// ===== COPY BUTTON =====
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// ===== STATUS CHECKER =====
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Please enter your Print ID (e.g., Print-1234).");
    return;
  }

  statusResult.textContent = "⏳ Checking status...";

  try {
    // 1️⃣ Fetch print record from Supabase
    const resPrint = await fetch(
      `${SUPABASE_URL}/rest/v1/prints?print_id=eq.${printId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!resPrint.ok) {
      throw new Error(`Supabase responded with ${resPrint.status}`);
    }

    const printData = await resPrint.json();
    if (!Array.isArray(printData) || printData.length === 0) {
      statusResult.textContent = "❌ No record found for this Print ID.";
      return;
    }

    const print = printData[0];
    const printCode = print.print_code || "(Unknown Code)";
    const paymentStat = print.payment_stat || "Unpaid";
    const printStatus = print.print_status || "Pending";

    // 2️⃣ Check PayMongo payments
    const resPay = await fetch("https://api.paymongo.com/v1/payments", {
      headers: {
        Authorization: `Basic ${btoa(PAYMONGO_SECRET + ":")}`,
      },
    });
    const data = await resPay.json();

    let paymentMsg = "🧾 No payment found.";
    if (Array.isArray(data.data)) {
      const payment = data.data.find(
        (p) => p.attributes?.metadata?.print_id === printId
      );
      if (payment) {
        const status = payment.attributes.status;
        if (status === "paid") paymentMsg = "✅ Paid / Approved";
        else if (status === "failed") paymentMsg = "❌ Payment Failed / Rejected";
        else paymentMsg = `⌛ Payment Status: ${status}`;
      }
    }

    // 3️⃣ Show info
    statusResult.innerHTML = `
      <strong>Print Code:</strong> ${printCode}<br>
      <strong>Payment:</strong> ${paymentMsg}<br>
      <strong>Database Payment Stat:</strong> ${paymentStat}<br>
      <strong>Print Status:</strong> ${printStatus}
    `;
  } catch (err) {
    console.error("❌ Error checking status:", err);
    statusResult.textContent = "Error checking status.";
  }
});
