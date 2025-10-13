// app.js

const API_BASE = "https://gtmchmkgjtsowgwrasye.supabase.co/functions/v1";

const uploadPayBtn = document.getElementById("uploadPayBtn");
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

const statusPrintId = document.getElementById("statusPrintId");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusResult = document.getElementById("statusResult");

// === Upload + Pay ===
uploadPayBtn.addEventListener("click", async () => {
  const form = new FormData(document.getElementById("printForm"));
  try {
    const resp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: form,
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Failed to create print");

    const printId = data.print_id || "Unknown";

    printIdText.textContent = printId;
    popup.classList.remove("hidden");

    // Create checkout session
    const checkoutResp = await fetch(`${API_BASE}/createCheckout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printId,
        amount: form.get("amount"),
        name: form.get("name"),
      }),
    });

    const checkoutData = await checkoutResp.json();
    if (!checkoutResp.ok) throw new Error(checkoutData.error);

    // Redirect to PayMongo Checkout (test mode)
    window.open(checkoutData.checkout_url, "_blank");
  } catch (err) {
    console.error(err);
    alert("Network error - please check your connection and try again.");
  }
});

// === Popup Actions ===
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  alert("Print ID copied!");
});

closePopupBtn.addEventListener("click", () => {
  popup.classList.add("hidden");
});

// === Check Status ===
checkStatusBtn.addEventListener("click", async () => {
  const printId = statusPrintId.value.trim();
  if (!printId) {
    alert("Please enter your Print ID.");
    return;
  }

  statusResult.textContent = "Checking status...";

  try {
    const resp = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printId }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Failed to fetch status.");

    statusResult.innerHTML = `
      <p><b>Print Code:</b> ${data.print_code}</p>
      <p><b>Payment Status:</b> ${data.payment_stat}</p>
      <p><b>Print Status:</b> ${data.print_status}</p>
      <p><b>Notification:</b> ${data.notification}</p>
    `;
  } catch (err) {
    console.error(err);
    statusResult.textContent = "Error checking status.";
  }
});
