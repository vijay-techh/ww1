// Check session validity on page load
if (window.sessionManager && !window.sessionManager.isSessionValid()) {
  window.sessionManager.logout(true, "Please login to access this page.");
}

// Profile page JavaScript - works exactly like User Management info function
const rawUser = localStorage.getItem("user");
const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  window.location.href = "/index.html";
}

// Hide admin navigation options for non-admin users
const adminMenu = document.getElementById("adminUsersMenu");
const assignMenu = document.getElementById("assignEmployeesMenu");
const dealerKhataMenu = document.getElementById("dealerKhataMenu");
const myKhataMenu = document.getElementById("myKhataMenu");

if (user.role === "admin") {
  if (adminMenu) adminMenu.style.display = "block";
  if (assignMenu) assignMenu.style.display = "block";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "block";
} else if (user.role === "dealer") {
  // Show dealer menu for dealers
  if (myKhataMenu) myKhataMenu.style.display = "block";
  
  // Change logo to WheelsPartner for dealers
  const logo = document.getElementById("logo");
  if (logo) {
    logo.textContent = "WheelsPartner";
  }
  
  // Hide admin menus
  if (adminMenu) adminMenu.style.display = "none";
  if (assignMenu) assignMenu.style.display = "none";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "none";
} else if (user.role === "employee") {
  // Hide admin menus for employees
  if (adminMenu) adminMenu.style.display = "none";
  if (assignMenu) assignMenu.style.display = "none";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "none";
}

if (user.role !== "employee") {
  const dealerLeadBtn = document.getElementById("dealerLeadBtn");
  if (dealerLeadBtn) dealerLeadBtn.style.display = "none";
}

function openDealerLeads(){
  // open view cases page with dealer filter
  window.location.href = "/view-cases.html?dealerView=1";
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "/index.html";
}

// Load user profile data - same as User Management info function
async function loadUserProfile() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;
    
    // Load detailed profile based on role - using same endpoints as User Management
    await loadDetailedProfile(currentUser.role, currentUser.id);
    
  } catch (error) {
    console.error('Error loading user profile:', error);
    showEmptyProfileFields();
  }
}

async function loadDetailedProfile(role, userId) {
  try {
    let profileData = null;
    
    console.log(`[Profile] Loading profile for role: ${role}, userId: ${userId}`);
    
    // 🟢 MANAGER
    if (role === 'manager') {
      try {
        const url = `/api/user/manager-info/${userId}`;
        console.log(`[Profile] Fetching: ${url}`);
        const response = await fetch(url);
        console.log(`[Profile] Manager API status: ${response.status}`);
        if (response.ok) {
          profileData = await response.json();
          console.log(`[Profile] Manager data received:`, profileData);
        } else {
          const errorText = await response.text();
          console.error(`[Profile] Manager API error: ${response.status} - ${errorText}`);
          profileData = null;
        }
      } catch (err) {
        console.error('[Profile] Manager fetch error:', err);
        profileData = null;
      }
    }

    // 🟢 EMPLOYEE
    else if (role === "employee") {
      try {
        const url = `/api/user/employee-info/${userId}`;
        console.log(`[Profile] Fetching: ${url}`);
        const response = await fetch(url);
        console.log(`[Profile] Employee API status: ${response.status}`);
        if (response.ok) {
          profileData = await response.json();
          console.log(`[Profile] Employee data received:`, profileData);
        } else {
          const errorText = await response.text();
          console.error(`[Profile] Employee API error: ${response.status} - ${errorText}`);
          profileData = null;
        }
      } catch (err) {
        console.error('[Profile] Employee fetch error:', err);
        profileData = null;
      }
    }

    // 🟢 DEALER
    else if (role === "dealer") {
      try {
        const url = `/api/user/dealer-info/${userId}`;
        console.log(`[Profile] Fetching: ${url}`);
        const response = await fetch(url);
        console.log(`[Profile] Dealer API status: ${response.status}`);
        if (response.ok) {
          profileData = await response.json();
          console.log(`[Profile] Dealer data received:`, profileData);
        } else {
          const errorText = await response.text();
          console.error(`[Profile] Dealer API error: ${response.status} - ${errorText}`);
          profileData = null;
        }
      } catch (err) {
        console.error('[Profile] Dealer fetch error:', err);
        profileData = null;
      }
    }

    if (profileData) {
      console.log("[Profile] Data loaded, updating UI...");
      updateProfileFields(profileData, role);
    } else {
      console.log("[Profile] No data found, showing empty fields");
      showEmptyProfileFields();
    }

  } catch (err) {
    console.error("[Profile] Load error:", err);
    showEmptyProfileFields();
  }
}


function updateProfileFields(data, role) {
  console.log('Updating profile fields for role:', role, 'with data:', data);
  
  // Display profile information in the same format as User Management info function
  if (role === 'employee') {
    // Employee format - same as admin-users.js openEmployeeInfo function
    const personalInfoHtml = `
      <div class="info-item">
        <label>Name:</label>
        <span id="profileName">${data.first_name || '-'} ${data.last_name || ''}</span>
      </div>
      <div class="info-item" id="profileEmployeeIdRow" style="display: flex;">
        <label>Employee ID:</label>
        <span id="profileEmployeeId">${data.employee_id || '-'}</span>
      </div>
      <div class="info-item">
        <label>DOB:</label>
        <span id="profileDob">${data.dob ? new Date(data.dob).toLocaleDateString('en-IN') : '-'}</span>
      </div>
      <div class="info-item">
        <label>Joining Date:</label>
        <span id="profileJoiningDate">${data.joining_date ? new Date(data.joining_date).toLocaleDateString('en-IN') : '-'}</span>
      </div>
      <div class="info-item">
        <label>PAN:</label>
        <span id="profilePan">${data.pan_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Aadhar:</label>
        <span id="profileAadhar">${data.aadhar_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mobile:</label>
        <span id="profileMobile">${data.mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Father's Mobile:</label>
        <span id="profileFatherMobile">${data.father_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mother's Mobile:</label>
        <span id="profileMotherMobile">${data.mother_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Personal Email:</label>
        <span id="profilePersonalEmail">${data.personal_email || '-'}</span>
      </div>
      <div class="info-item">
        <label>Office Email:</label>
        <span id="profileOfficeEmail">${data.office_email || '-'}</span>
      </div>
      <div class="info-item">
        <label>Location:</label>
        <span id="profileLocation">${data.location || '-'}</span>
      </div>
    `;
    
    const bankInfoHtml = `
      <div class="info-item">
        <label>Bank Name:</label>
        <span id="profileBankName">${data.bank_name || '-'}</span>
      </div>
      <div class="info-item">
        <label>Account Number:</label>
        <span id="profileAccountNo">${data.account_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>IFSC:</label>
        <span id="profileIfsc">${data.ifsc || '-'}</span>
      </div>
      <div class="info-item">
        <label>Branch:</label>
        <span id="profileBankBranch">${data.bank_branch || '-'}</span>
      </div>
    `;
    
    document.getElementById('profilePersonalInfo').innerHTML = personalInfoHtml;
    document.getElementById('profileBankInfo').innerHTML = bankInfoHtml;
    
  } else if (role === 'dealer') {
    // Dealer format - same as admin-users.js openDealerInfo function
    const personalInfoHtml = `
      <div class="info-item">
        <label>Name:</label>
        <span id="profileName">${data.dealer_name || '-'}</span>
      </div>
      <div class="info-item" id="profileDealerCodeRow" style="display: flex;">
        <label>Dealer Code:</label>
        <span id="profileDealerCode">${data.dealer_code || '-'}</span>
      </div>
      <div class="info-item">
        <label>DOB:</label>
        <span id="profileDob">${data.dob ? new Date(data.dob).toLocaleDateString('en-IN') : '-'}</span>
      </div>
      <div class="info-item">
        <label>PAN:</label>
        <span id="profilePan">${data.pan_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Aadhar:</label>
        <span id="profileAadhar">${data.aadhar_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mobile:</label>
        <span id="profileMobile">${data.mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Father's Mobile:</label>
        <span id="profileFatherMobile">${data.father_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mother's Mobile:</label>
        <span id="profileMotherMobile">${data.mother_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Email:</label>
        <span id="profilePersonalEmail">${data.email || '-'}</span>
      </div>
      <div class="info-item">
        <label>Location:</label>
        <span id="profileLocation">${data.location || '-'}</span>
      </div>
    `;
    
    const bankInfoHtml = `
      <div class="info-item">
        <label>Bank Name:</label>
        <span id="profileBankName">${data.bank_name || '-'}</span>
      </div>
      <div class="info-item">
        <label>Account Number:</label>
        <span id="profileAccountNo">${data.account_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>IFSC:</label>
        <span id="profileIfsc">${data.ifsc || '-'}</span>
      </div>
      <div class="info-item">
        <label>Branch:</label>
        <span id="profileBankBranch">${data.bank_branch || '-'}</span>
      </div>
    `;
    
    document.getElementById('profilePersonalInfo').innerHTML = personalInfoHtml;
    document.getElementById('profileBankInfo').innerHTML = bankInfoHtml;
    
  } else if (role === 'manager') {
    // Manager format - similar structure
    const personalInfoHtml = `
      <div class="info-item">
        <label>Name:</label>
        <span id="profileName">${data.first_name || '-'} ${data.last_name || ''}</span>
      </div>
      <div class="info-item" id="profileEmployeeIdRow" style="display: flex;">
        <label>Manager ID:</label>
        <span id="profileEmployeeId">MGR${(data.id || '').toString().padStart(4, '0')}</span>
      </div>
      <div class="info-item">
        <label>DOB:</label>
        <span id="profileDob">${data.dob ? new Date(data.dob).toLocaleDateString('en-IN') : '-'}</span>
      </div>
      <div class="info-item">
        <label>Joining Date:</label>
        <span id="profileJoiningDate">${data.joining_date ? new Date(data.joining_date).toLocaleDateString('en-IN') : '-'}</span>
      </div>
      <div class="info-item">
        <label>PAN:</label>
        <span id="profilePan">${data.pan || '-'}</span>
      </div>
      <div class="info-item">
        <label>Aadhar:</label>
        <span id="profileAadhar">${data.aadhar || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mobile:</label>
        <span id="profileMobile">${data.mobile || '-'}</span>
      </div>
      <div class="info-item">
        <label>Father's Mobile:</label>
        <span id="profileFatherMobile">${data.father_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Mother's Mobile:</label>
        <span id="profileMotherMobile">${data.mother_mobile_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>Personal Email:</label>
        <span id="profilePersonalEmail">${data.personal_email || '-'}</span>
      </div>
      <div class="info-item">
        <label>Office Email:</label>
        <span id="profileOfficeEmail">${data.office_email || '-'}</span>
      </div>
      <div class="info-item">
        <label>Location:</label>
        <span id="profileLocation">${data.location || '-'}</span>
      </div>
    `;
    
    const bankInfoHtml = `
      <div class="info-item">
        <label>Bank Name:</label>
        <span id="profileBankName">${data.bank_name || '-'}</span>
      </div>
      <div class="info-item">
        <label>Account Number:</label>
        <span id="profileAccountNo">${data.account_no || '-'}</span>
      </div>
      <div class="info-item">
        <label>IFSC:</label>
        <span id="profileIfsc">${data.ifsc || '-'}</span>
      </div>
      <div class="info-item">
        <label>Branch:</label>
        <span id="profileBankBranch">${data.bank_branch || '-'}</span>
      </div>
    `;
    
    document.getElementById('profilePersonalInfo').innerHTML = personalInfoHtml;
    document.getElementById('profileBankInfo').innerHTML = bankInfoHtml;
  }
}

function showEmptyProfileFields() {
  console.log('Showing empty profile fields');
  
  const personalInfoHtml = `
    <div class="info-item">
      <label>Name:</label>
      <span id="profileName">-</span>
    </div>
    <div class="info-item" id="profileEmployeeIdRow" style="display: none;">
      <label>Employee ID:</label>
      <span id="profileEmployeeId">-</span>
    </div>
    <div class="info-item" id="profileDealerCodeRow" style="display: none;">
      <label>Dealer Code:</label>
      <span id="profileDealerCode">-</span>
    </div>
    <div class="info-item">
      <label>DOB:</label>
      <span id="profileDob">-</span>
    </div>
    <div class="info-item">
      <label>Joining Date:</label>
      <span id="profileJoiningDate">-</span>
    </div>
    <div class="info-item">
      <label>PAN:</label>
      <span id="profilePan">-</span>
    </div>
    <div class="info-item">
      <label>Aadhar:</label>
      <span id="profileAadhar">-</span>
    </div>
    <div class="info-item">
      <label>Mobile:</label>
      <span id="profileMobile">-</span>
    </div>
    <div class="info-item">
      <label>Father's Mobile:</label>
      <span id="profileFatherMobile">-</span>
    </div>
    <div class="info-item">
      <label>Mother's Mobile:</label>
      <span id="profileMotherMobile">-</span>
    </div>
    <div class="info-item">
      <label>Personal Email:</label>
      <span id="profilePersonalEmail">-</span>
    </div>
    <div class="info-item">
      <label>Office Email:</label>
      <span id="profileOfficeEmail">-</span>
    </div>
    <div class="info-item">
      <label>Location:</label>
      <span id="profileLocation">-</span>
    </div>
  `;
  
  const bankInfoHtml = `
    <div class="info-item">
      <label>Bank Name:</label>
      <span id="profileBankName">-</span>
    </div>
    <div class="info-item">
      <label>Account Number:</label>
      <span id="profileAccountNo">-</span>
    </div>
    <div class="info-item">
      <label>IFSC:</label>
      <span id="profileIfsc">-</span>
    </div>
    <div class="info-item">
      <label>Branch:</label>
      <span id="profileBankBranch">-</span>
    </div>
  `;
  
  document.getElementById('profilePersonalInfo').innerHTML = personalInfoHtml;
  document.getElementById('profileBankInfo').innerHTML = bankInfoHtml;
}

// Load profile data when page loads
document.addEventListener('DOMContentLoaded', loadUserProfile);