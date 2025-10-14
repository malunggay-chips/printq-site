// js/app.js
import { API_BASE } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const calcBtn = document.getElementById("calcBtn");
  const uploadPayBtn = document.getElementById("uploadPayBtn");
  const fulfillRadios = document.querySelectorAll('input[name="fulfill"]');
  const locationRow = document.getElementById("locationRow");
  const calcResult = document.getElementById("calcResult");

  const popup = document.getElementById("popup");
  const printIdText = document.getElementById("printIdText");
  const copyBtn = document.getElementById("copyBtn");
  const closePopupBtn = document.getElementById("closePopupBtn");

  const checkStatusBtn = document.getElementById("checkStatusBtn");
  const statusInput = document.getElementById("statusPrintId");
  const statusResult = document.getElementById("statusResult");

  let totalAmount = 0;
  let currentPrintId = null;

  // Show/hide delivery location input
  fulfillRadios.forEach((r) => {
    r.addEventListener("change", () => {
      if (document.querySelector('input[name="fulfill"]:checked')?.value === "delivery") {
        locationRow.classList.remove("hidden");
      } else {
        locationRow.classList.add("hidden");
      }
    });
  });

  // Calculate price
  calcBtn.addEventListener("click", () => {
    const pages = parseInt(document.getElementById("pages").value || 0);
    const copies = parseInt(document.getElementById("copies").value || 0);
    const color = document.querySelector('input[name="color"]:checked');
    const fulfill = document.querySelector('input[name="fulfill"]:checked');

    if (!pages || !copies || !color || !fulfill) {
      calcResult.textContent = "Please fill all required fields before calculating.";
      return;
    }

    const rate = color.value === "color" ? 10 : 5;
    totalAmount = pages * copies * rate;
    if (fulfill.value === "delivery") totalAmount += 20;

    calcResult.textContent = `Total: ₱${totalAmount}`;
  });

  // Upload & Pay
  uploadPayBtn.addEventListener("click", async () => {
    try {
      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const pages = document.getElementById("pages").value;
      const copies = document.getElementById("copies").value;
      const color = document.querySelector('input[name="color"]:checked')?.value;
      const fulfill = document.querySelector('input[name="fulfill"]:checked')?.value;
      const location = document.getElementById("location").value.trim();
      const files = document.getElementById("files").files;

      if (!name || !phone || !pages || !copies || !color || !fulfill || files.length === 0) {
        alert("Please fill in all required fields and upload at least one file.");
        return;
      }

      if (totalAmount === 0) {
        alert("Please click 'Calculate' before uploading.");
        return;
      }

      // Build FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("pages", pages);
      formData.append("copies", copies);
      formData.append("color", color);
      formData.append("fulfill", fulfill);
      formData.append("location", location);
      formData.append("amount", totalAmount);
      for (let f of files) formData.append("files", f);

      // Call createPrint
      const printResp = await fetch(`${API_BASE}/createPrint`, {
        method: "POST",
        body: formData,
      });

      const printData = await printResp.json();
      console.log("🧾 createPrint response:", printData);

      if (!printResp.ok || !printData.print_id) {
        alert("There was a problem creating your print. Please try again.");
        return;
      }

      currentPrintId = printData.print_id;
      printIdText.textContent = currentPrintId;

      // Show popup
      popup.classList.remove("hidden");

      // Copy ID button
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(currentPrintId);
        alert("Print ID copied!");
      };

      // Close popup → start checkout
      closePopupBtn.onclick = async () => {
        popup.classList.add("hidden");
        await startCheckout(currentPrintId, totalAmount);
      };
    } catch (err) {
      console.error("❌ Upload error:", err);
      alert("Network error - please check your connection and try again.");
    }
  });

  // Start PayMongo checkout
  async function startCheckout(printId, amount) {
    if (!printId || !amount) {
      alert("Missing print ID or amount for checkout.");
      return;
    }

    try {
      console.log("🧾 Starting checkout for:", printId, "₱", amount);

      const resp = await fetch(`${API_BASE}/createCheckout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printId, amount }),
      });

      const data = await resp.json();
      console.log("💰 createCheckout response:", data);

      if (!resp.ok || !data.checkoutUrl) {
        alert("Error starting payment. Try again later.");
        return;
      }

      // Redirect to PayMongo checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("❌ Checkout error:", err);
      alert("Network error - please check your connection and try again.");
    }
  }

  // Check print status
  checkStatusBtn.addEventListener("click", async () => {
    const printId = statusInput.value.trim();
    if (!printId) {
      statusResult.textContent = "Please enter your Print ID.";
      return;
    }

    statusResult.textContent = "Checking status...";

    try {
      console.log("🧾 Checking status for:", printId);

      const resp = await fetch(`${API_BASE}/checkStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printId }),
      });

      const data = await resp.json();
      console.log("📦 checkStatus response:", data);

      if (!resp.ok || !data.success) {
        statusResult.textContent = "Error checking status.";
        return;
      }

      statusResult.innerHTML = `
        ✅ <b>Print Code:</b> ${data.print_code}<br>
        💵 <b>Payment:</b> ${data.payment_stat}<br>
        🖨️ <b>Status:</b> ${data.print_status}
      `;
    } catch (err) {
      console.error("❌ Status check error:", err);
      statusResult.textContent = "Error checking status.";
    }
  });
});
