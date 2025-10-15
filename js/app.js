// js/app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYMONGO_SECRET } from "./config.js";

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

// ====== PRICE CALCULATION ======
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

// ====== FULFILLMENT HANDLER ======
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

// ====== UPLOAD + PAY FLOW ======
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
    // Generate a unique print ID
    const printId = `Print-${Math.floor(1000 + Math.random() * 9000)}`;
    const printCode = `${name}-${Date.now()}`;

    // Insert record directly into Supabase
    const { error } = await supabase.from("prints").insert([
      {
        print_id: printId,
        name,
        phone,
        pages,
        copies,
        color,
        fulfill,
        location,
        amount,
        payment_stat: "unpaid",
        print_status: "pending",
        print_code: printCode
      }
    ]);

    if (error) throw error;

    // Show popup
    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // When popup closed, start payment
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");
      await startPaymongoCheckout(printId, amount);
    };
  } catch (err) {
    console.error("❌ Error inserting print:", err);
    alert("Network error — please check your connection and try again.");
  }
});

// ====== PAYMONGO CHECKOUT ======
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
            description: `Print Order ${printId}`,
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
          },
        },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(json.errors?.[0]?.detail || "Error starting payment");

    window.location.href = json.data.attributes.checkout_url;
  } catch (err) {
    console.error("❌ Error starting payment:", err);
    alert("Error starting payment. Try again later.");
  }
}

// ====== COPY BUTTON ======
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// ====== CHECK STATUS ======
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) return alert("Please enter a valid Print ID.");
  statusResult.textContent = "Checking status...";

  try {
    const { data, error } = await supabase
      .from("prints")
      .select("name, payment_stat, print_status, print_code")
      .eq("print_id", printId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      statusResult.textContent = "No record found for this Print ID.";
      return;
    }

    const { name, payment_stat, print_status, print_code } = data;
    statusResult.innerHTML = `
      🧾 <strong>Print Code:</strong> ${print_code}<br>
      💰 <strong>Payment:</strong> ${payment_stat}<br>
      🖨️ <strong>Status:</strong> ${print_status}
    `;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
