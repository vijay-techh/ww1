// Check session validity on page load
if (window.sessionManager && !window.sessionManager.isSessionValid()) {
  window.sessionManager.logout(true, "Please login to access this page.");
}

console.log("New Lead JS loaded");

/* =========================
   STEP 1 → STEP 2 FLOW
========================= */
    // viji
document.getElementById("nextBtn").addEventListener("click", () => {
  const loanType = document.getElementById("loanType").value;

  if (!loanType) {
    alert("Please select a loan type");
    return;
  }

  // Save selected loan type (optional but useful)
  localStorage.setItem("loanType", loanType);

  // Redirect to loan-specific page
  window.location.href = `/${loanType}.html`;
});
/* =========================document.getElementById("nextBtn").addEventListener("click", () => {
  const loanType = document.getElementById("loanType").value;

if (!loanType) {
  alert("Please select loan type");
  return;
}

localStorage.setItem("loanType", loanType);
   AUTO LOAN ID (TEMP)
   Backend will overwrite
========================= */
// document.getElementById("loanId").value = Date.now();  vijvijvijviv

/* =========================
   DATE & TIME
========================= */
// document.getElementById("dateTime").value = new Date().toLocaleString(); vijvivijvj

/* =========================
   MFG YEAR DROPDOWN
========================= */
const mfgYearSelect = document.getElementById("mfgYear");
for (let year = 2010; year <= 2027; year++) {
  const opt = document.createElement("option");
  opt.value = year;
  opt.textContent = year;
  mfgYearSelect.appendChild(opt);
}

/* =========================
   COPY ADDRESS BUTTONS
========================= */
document
  .getElementById("copyCurrentFromPermanent")
  .addEventListener("click", () => {
    document.getElementById("currentAddress").value =
      document.getElementById("permanentAddress").value;
    document.getElementById("currentLandmark").value =
      document.getElementById("permanentLandmark").value;
    document.getElementById("currentCategory").value =
      document.getElementById("permanentCategory").value;
  });

document
  .getElementById("copyOfficeFromPermanent")
  .addEventListener("click", () => {
    document.getElementById("officeAddress").value =
      document.getElementById("permanentAddress").value;
    document.getElementById("officeLandmark").value =
      document.getElementById("permanentLandmark").value;
  });

/* =========================
   FORCE UPPERCASE FOR NAMES
========================= */
function enforceUppercase() {
  const uppercaseInputs = document.querySelectorAll("[data-uppercase]");
  uppercaseInputs.forEach((input) => {
    const toUpper = () => {
      input.value = input.value.toUpperCase();
    };
    input.addEventListener("input", toUpper);
    input.addEventListener("blur", toUpper);
    toUpper();
  });
}

enforceUppercase();

/* =========================
   SUBMIT FORM
========================= */
document.getElementById("leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  /* 🔴 Mandatory fields (as per your requirement) */
  const requiredFields = [
    "type",
    "name",
    "gender",
    "customerProfile",
    "pan",
    "mobile",
    "email",
    "loanAmount",
    "dsa",
    "rcNo",
    "vehicle",
    "vehicleOwnerContact",
    "permanentAddress",
    "permanentLandmark",
    "permanentCategory",
    "officeEmploymentDetail",
    "casedealer"
  ];

  for (let id of requiredFields) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      alert(`Please fill mandatory field`);
      el.focus();
      return;
    }
  }

  /* 📦 Collect all form data */
  const leadData = {};
  document
    .querySelectorAll("#leadForm input, #leadForm select, #leadForm textarea")
    .forEach((el) => {
      leadData[el.id] = el.value;
    });

  /* =========================
     STEP 4: ADD STEP-1 DATA
  ========================= */
  leadData.loanType = localStorage.getItem("loanType");

  /* =========================
     STEP 5: ADD USER DATA
  ========================= */
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("Session expired. Please login again.");
    window.location.href = "/index.html";
    return;
  }
  
  leadData.userId = user.id;
  leadData.role = user.role;

  console.log("Submitting lead with user:", { userId: user.id, role: user.role });

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`Failed to save lead: ${errorData.error || 'Unknown error'}`);
      return;
    }

    // success → go to My Leads
    window.location.href = "/view-cases.html";
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
});





