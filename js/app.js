// js/app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYMONGO_SECRET, API_BASE } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==== ELEMENTS ====
const form = document.getElementById("printForm");
const calcBtn = document.getElementById("calcBtn");
const uploadPayBtn = document.getElementById("uploadPayBtn");
const calcResult = document.getElementById("calcResult");
const locationRow = document.getElementById("locationRow");
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const closePopupBtn = document.getElementById("closePopupBtn");
const copyBtn = document.getElementById("copyBtn");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusResult = document.getElementById("statusResult");

// ==== HELPERS ====
function getVal(id) {
  return document.getElementById(id).value.trim();
}
function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
function calcTotal() {
  const pages = +getVal("pages");
  const copies = +getVal("copies");
  const color = getRadio("color");
  const fulfill = getRadio("fulfill");
  if (!pages || !copies || !color) return null;
  let per = color === "color" ? 10 : 5;
  let total = pages * copies * per;
  if (fulfill === "delivery") total += 20;
  return total;
}

// ==== DELIVERY VISIBILITY ====
document.querySelectorAll('input[name="fulfill"]').forEach(r => {
  r.addEventListener("change", () => {
    const f = getRadio("fulfill");
    locationRow.classList.toggle("hidden", f !== "delivery");
  });
});

// ==== PRICE CALCULATOR ====
calcBtn.addEventListener("click", () => {
  const total = calcTotal();
  calcResult.textContent = total ? `Total: ₱${total}` : "Please fill all fields.";
});

// ==== UPLOAD + PAY ====
uploadPayBtn.addEventListener("click", async () => {
  const name = getVal("name");
  const phone = getVal("phone");
  const pages = getVal("pages");
  const copies = getVal("copies");
  const color = getRadio("color");
  const fulfill = getRadio("fulfill");
  const location = getVal("location");
  const amount = calcTotal();
  const files = document.getElementById("files").files;

  if (!name || !phone || !pages || !copies || !color || !fulfill || !files.length) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    // Send to Supabase Edge Function (createPrint)
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

    const res = await fetch(`${API_BASE}/createPrint`, { method: "POST", body: formData });
    const resultText = await res.text();

    // Try to safely parse JSON
    let data;
    try {
      data = JSON.parse(resultText);
    } catch {
      console.error("Invalid JSON from createPrint:", resultText);
      alert("Error creating print. Please try again.");
      return;
    }

    if (!data?.print_id) {
      alert("Failed to create print order. Please try again.");
      return;
    }

    const printId = data.print_id;

    // Show Print ID popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // On popup close → start payment
    closePopupBtn.onclick = () => {
      popup.classList.add("hidden");
      startPaymongo(printId, amount);
    };
  } catch (err) {
    console.error(err);
    alert("Network error — please check your connection and try again.");
  }
});

// ==== PAYMONGO CHECKOUT ====
async function startPaymongo(printId, amount) {
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
            description: `Payment for ${printId}`,
            payment_method_types: ["gcash", "paymaya"],
            send_email_receipt: false,
            show_description: false,
            show_line_items: false,
            line_items: [
              {
                name: printId,
                amount: amount * 100,
                currency: "PHP",
                quantity: 1,
              },
            ],
            success_url: window.location.href,
            cancel_url: window.location.href,
          },
        },
      }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Invalid JSON from PayMongo:", text);
      alert("Error starting payment. Try again later.");
      return;
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      console.error("No checkout URL:", data);
      alert("Error starting payment. Try again later.");
      return;
    }

    await supabase.from("prints").update({ checkout_url: checkoutUrl }).eq("print_id", printId);

    // Redirect to PayMongo test checkout
    window.location.href = checkoutUrl;
  } catch (err) {
    console.error("Payment error:", err);
    alert("Network error — please check your connection and try again.");
  }
}

// ==== COPY BUTTON ====
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// ==== STATUS CHECK ====
checkStatusBtn.addEventListener("click", async () => {
  const pid = document.getElementById("statusPrintId").value.trim();
  if (!pid) return alert("Enter a Print ID first.");

  statusResult.textContent = "Checking status...";

  const { data, error } = await supabase.from("prints").select("*").eq("print_id", pid).single();

  if (error || !data) {
    console.error("Error checking status:", error);
    statusResult.textContent = "Error checking status.";
    return;
  }

  statusResult.textContent = `🧾 Print Code: ${data.print_code}
💰 Payment: ${data.payment_stat}
📦 Status: ${data.print_status}`;
});
