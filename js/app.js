import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE } from "./config.js";

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
const closePopupBtn = document.getElementById("closePopupBtn");
const copyBtn = document.getElementById("copyBtn");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusPrintId = document.getElementById("statusPrintId");
const statusResult = document.getElementById("statusResult");

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

// Fulfillment toggle
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

// Calculate button
calcBtn.addEventListener("click", () => {
  const amount = calculatePrice();
  calcResult.textContent = amount ? `Total: ₱${amount}` : "Please fill all fields.";
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
  const files = filesInput.files;
  const amount = calculatePrice();

  if (!name || !phone || !pages || !copies || !color || !fulfill || !amount || !files.length) {
    alert("Please complete all fields.");
    return;
  }

  const print_id = `Print-${Math.floor(1000 + Math.random() * 9000)}`;
  const print_code = `${name}-${Date.now()}`;

  const { error } = await supabase.from("prints").insert({
    print_id, print_code, name, phone, pages, copies, color, fulfill, location, amount
  });

  if (error) {
    alert("Error saving data.");
    console.error(error);
    return;
  }

  printIdText.textContent = print_id;
  popup.classList.remove("hidden");

  closePopupBtn.onclick = async () => {
    popup.classList.add("hidden");
    await startCheckout(print_id, amount);
  };
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

// Checkout
async function startCheckout(print_id, amount) {
  try {
    console.log("🧾 Sending checkout request:", { print_id, amount });

    const res = await fetch(`${API_BASE}/createCheckout`, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": window.location.origin,
      },
      body: JSON.stringify({ print_id, amount }),
    });

    const text = await res.text(); // read raw response for better error checking
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Invalid JSON from server:", text);
      throw new Error("Server returned invalid JSON");
    }

    if (!res.ok) {
      console.error("Checkout failed:", data);
      throw new Error(data.error || "Failed to create checkout");
    }

    if (!data.checkout_url) {
      console.error("❌ No checkout_url in response:", data);
      throw new Error("No checkout URL from PayMongo");
    }

    console.log("✅ Redirecting to PayMongo checkout:", data.checkout_url);
    window.location.href = data.checkout_url;
  } catch (err) {
    console.error("❌ Error starting checkout:", err);
    alert("Network error — please check your connection and try again.");
  }
}

// Status checker
checkStatusBtn.addEventListener("click", async () => {
  const pid = statusPrintId.value.trim();
  if (!pid) return alert("Enter a Print ID.");

  const { data, error } = await supabase.from("prints").select("*").eq("print_id", pid).single();

  if (error || !data) {
    statusResult.textContent = "❌ No record found for this Print ID.";
    return;
  }

  statusResult.innerHTML = `
    <strong>Print Code:</strong> ${data.print_code}<br>
    <strong>Payment:</strong> ${data.payment_stat}<br>
    <strong>Status:</strong> ${data.print_status}
  `;
});
