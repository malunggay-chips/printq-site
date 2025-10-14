import { API_BASE } from "./config.js";

const form = document.getElementById("printForm");
const calcBtn = document.getElementById("calcBtn");
const uploadPayBtn = document.getElementById("uploadPayBtn");
const calcResult = document.getElementById("calcResult");
const locationRow = document.getElementById("locationRow");
const fulfillRadios = document.querySelectorAll("input[name='fulfill']");
const popup = document.getElementById("popup");
const printIdText = document.getElementById("printIdText");
const copyBtn = document.getElementById("copyBtn");
const closePopupBtn = document.getElementById("closePopupBtn");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const statusResult = document.getElementById("statusResult");

let totalAmount = 0;
let lastPrintId = null;

// ---- Calculate total ----
calcBtn.addEventListener("click", () => {
  const pages = parseInt(document.getElementById("pages").value) || 0;
  const copies = parseInt(document.getElementById("copies").value) || 0;
  const color = document.querySelector("input[name='color']:checked");
  const fulfill = document.querySelector("input[name='fulfill']:checked");

  if (!pages || !copies || !color || !fulfill) {
    calcResult.textContent = "Please fill all required fields.";
    return;
  }

  let baseRate = color.value === "color" ? 10 : 5;
  totalAmount = pages * copies * baseRate;
  if (fulfill.value === "delivery") totalAmount += 20;

  calcResult.textContent = `Total amount: ₱${totalAmount}`;
});

// ---- Show/hide location input ----
fulfillRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "delivery") {
      locationRow.classList.remove("hidden");
    } else {
      locationRow.classList.add("hidden");
    }
  });
});

// ---- Upload & Pay ----
uploadPayBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const pages = document.getElementById("pages").value.trim();
  const copies = document.getElementById("copies").value.trim();
  const color = document.querySelector("input[name='color']:checked");
  const fulfill = document.querySelector("input[name='fulfill']:checked");
  const location = document.getElementById("location").value.trim();
  const files = document.getElementById("files").files;

  if (!name || !phone || !pages || !copies || !color || !fulfill || files.length === 0) {
    alert("Please complete the form before proceeding.");
    return;
  }

  if (totalAmount <= 0) {
    alert("Please calculate your total before paying.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("pages", pages);
    formData.append("copies", copies);
    formData.append("color", color.value);
    formData.append("fulfill", fulfill.value);
    formData.append("amount", totalAmount);
    if (fulfill.value === "delivery") formData.append("location", location);
    for (let f of files) formData.append("files", f);

    // Step 1: Create print
    const printResp = await fetch(`${API_BASE}/createPrint`, {
      method: "POST",
      body: formData,
    });

    const printData = await printResp.json();
    if (!printData.success || !printData.printId) {
      throw new Error("Failed to create print record.");
    }

    lastPrintId = printData.printId;
    printIdText.textContent = printData.printId;
    popup.classList.remove("hidden");

    // Step 2: Wait for user to close popup manually
    closePopupBtn.onclick = async () => {
      popup.classList.add("hidden");

      // Step 3: Create PayMongo Checkout session
      try {
        const checkoutResp = await fetch(`${API_BASE}/createCheckout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            printId: lastPrintId,
            amount: totalAmount,
          }),
        });

        const data = await checkoutResp.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert("Error starting payment. Try again later.");
          console.error("Checkout error:", data);
        }
      } catch (err) {
        console.error("Checkout request failed:", err);
        alert("Network error - please check your connection and try again.");
      }
    };
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Network error - please check your connection and try again.");
  }
});

// ---- Copy Print ID ----
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(printIdText.textContent);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
});

// ---- Check Status ----
checkStatusBtn.addEventListener("click", async () => {
  const printId = document.getElementById("statusPrintId").value.trim();
  if (!printId) {
    statusResult.textContent = "Please enter your Print ID.";
    return;
  }

  statusResult.textContent = "Checking status...";
  try {
    const res = await fetch(`${API_BASE}/checkStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printId }),
    });

    const data = await res.json();

    if (data.success) {
      statusResult.innerHTML = `
        <strong>Print Code:</strong> ${data.print_code}<br>
        💵 <strong>Payment:</strong> ${data.payment_stat}<br>
        🖨️ <strong>Status:</strong> ${data.print_status}
      `;
    } else {
      statusResult.textContent = "Error checking status.";
      console.error("Status error:", data);
    }
  } catch (err) {
    console.error("Status check failed:", err);
    statusResult.textContent = "Error checking status.";
  }
});
