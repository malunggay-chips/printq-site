// js/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYMONGO_SECRET, API_BASE } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// Show/hide delivery input
document.querySelectorAll('input[name="fulfill"]').forEach((r) => {
  r.addEventListener("change", () => {
    const v = getSelectedValue("fulfill");
    if (v === "delivery") locationRow.classList.remove("hidden");
    else locationRow.classList.add("hidden");
  });
});

// ====== PRICE CALCULATOR ======
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  if (!amount) {
    calcResult.textContent = "Please fill in valid values.";
    return;
  }
  calcResult.textContent = `Total: ₱${amount}`;
});

// ====== MAIN UPLOAD + PAY FLOW ======
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

  if (!files.length || !name || !phone || !pages || !copies || !color || !fulfill) {
    alert("Please fill all fields and upload at least one file.");
    return;
  }

  try {
    // Send to createPrint Edge Function
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
    const data = await resp.json();
    const printId = data.print_id || "Print-0000";

    // Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // Wait until popup is closed to start payment
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");
      await startPaymongoCheckout(printId, amount);
    };
  } catch (err) {
    console.error(err);
    alert("Network error — please check your connection and try again.");
  }
});

// ====== PAYMONGO CHECKOUT (TEST MODE) ======
async function startPaymongoCheckout(printId, amount) {
  try {
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(PAYMONGO_SECRET + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: false,
            show_line_items: false,
            payment_method_types: ["gcash", "paymaya"],
            line_items: [
              {
                name: printId,
                quantity: 1,
                amount: amount * 100, // in centavos
                currency: "PHP",
              },
            ],
            metadata: { printId },
            description: `Payment for ${printId}`,
            success_url: window.location.href,
            cancel_url: window.location.href,
          },
        },
      }),
    });

    const result = await response.json();
    const checkoutUrl = result.data?.attributes?.checkout_url;

    if (!checkoutUrl) {
      console.error(result);
      alert("Error starting payment. Try again later.");
      return;
    }

    // Save checkout URL in Supabase
    await supabase.from("prints").update({ checkout_url: checkoutUrl }).eq("print_id", printId);

    // Redirect to PayMongo test checkout
    window.location.href = checkoutUrl;
  } catch (err) {
    console.error("Payment error:", err);
    alert("Network error — please check your connection and try again.");
  }
}

// ====== COPY BUTTON ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// ====== STATUS CHECKER ======
checkStatusBtn.addEventListener("click", async () => {
  const pid = statusPrintId.value.trim();
  if (!pid) return alert("Enter a Print ID first.");
  statusResult.textContent = "Checking status...";

  const { data, error } = await supabase.from("prints").select("*").eq("print_id", pid).single();

  if (error || !data) {
    statusResult.textContent = "Error checking status.";
    return;
  }

  statusResult.textContent = `🧾 Print Code: ${data.print_code}\n💰 Payment: ${data.payment_stat}\n📦 Status: ${data.print_status}`;
});
