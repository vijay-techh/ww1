// Check session validity on page load
if (window.sessionManager && !window.sessionManager.isSessionValid()) {
  window.sessionManager.logout(true, "Please login to access the dashboard.");
}

const rawUser = localStorage.getItem("user");
const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  window.location.href = "/index.html";
}

if (user.role !== "employee") {
  const dealerLeadBtn = document.getElementById("dealerLeadBtn");
  if (dealerLeadBtn) dealerLeadBtn.style.display = "none";
}
function openDealerLeads(){
  // open view cases page with dealer filter
  window.location.href = "/view-cases.html?dealerView=1";
}

// Hide admin navigation options for non-admin users
const adminMenu = document.getElementById("adminUsersMenu");
const assignMenu = document.getElementById("assignEmployeesMenu");
const dealerKhataMenu = document.getElementById("dealerKhataMenu");
const myKhataMenu = document.getElementById("myKhataMenu");
const profileMenu = document.getElementById("profileMenu");

if (user.role === "admin") {
  if (adminMenu) adminMenu.style.display = "block";
  if (assignMenu) assignMenu.style.display = "block";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "block";
  if (profileMenu) profileMenu.style.display = "none";
  
  // Show notification bell for admins
  const notificationBell = document.getElementById("notificationBell");
  if (notificationBell) {
    notificationBell.style.display = "block";
  }
} else if (user.role === "dealer") {
  // Show dealer menu for dealers
  if (myKhataMenu) myKhataMenu.style.display = "block";
  
  // Show notification bell for dealers
  const notificationBell = document.getElementById("notificationBell");
  if (notificationBell) {
    notificationBell.style.display = "block";
  }
  
  // Change logo to WheelsPartner for dealers
  const logo = document.getElementById("logo");
  if (logo) {
    logo.textContent = "WheelsPartner";
  }
  
  // Hide admin menus
  if (adminMenu) adminMenu.style.display = "none";
  if (assignMenu) assignMenu.style.display = "none";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "none";
} else {
  // Hide for manager and employee roles
  if (adminMenu) adminMenu.style.display = "none";
  if (assignMenu) assignMenu.style.display = "none";
  if (dealerKhataMenu) dealerKhataMenu.style.display = "none";
  if (myKhataMenu) myKhataMenu.style.display = "none";
}

async function logout() {
  // Use session manager if available, otherwise just clear and redirect
  if (window.sessionManager) {
    await window.sessionManager.serverLogout();
  } else {
    localStorage.removeItem("user");
    window.location.href = "index.html";
  }
}

// 🎯 NOTIFICATION SYSTEM
let notificationPollingInterval;

async function loadNotifications() {
  if (user.role !== "admin" && user.role !== "dealer") {
    console.log("❌ User is not admin or dealer, skipping notifications");
    return;
  }
  
  console.log(`🔔 Loading notifications for ${user.role}:`, user.id);
  
  try {
    const endpoint = user.role === "admin" ? "/api/admin/notifications" : "/api/dealer/notifications";
    const header = user.role === "admin" ? { "x-admin-id": user.id } : { "x-dealer-id": user.id };
    
    const res = await fetch(endpoint, {
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken,
        ...(user.role === "admin" ? { "x-admin-id": user.id } : { "x-dealer-id": user.id })
      }
    });
    
    console.log("📡 Notifications API response status:", res.status);
    
    if (!res.ok) throw new Error("Failed to load notifications");
    
    const data = await res.json();
    console.log("📨 Notifications data received:", data);
    
    // Update badge
    const badge = document.getElementById("notificationBadge");
    if (badge) {
      badge.textContent = data.unreadCount || 0;
      badge.style.display = data.unreadCount > 0 ? "flex" : "none";
      console.log("🔢 Badge updated:", data.unreadCount);
    } else {
      console.log("❌ Notification badge element not found");
    }
    
    // Update notification list
    renderNotifications(data.notifications || []);
    
  } catch (err) {
    console.error("❌ Load notifications error:", err);
  }
}

function renderNotifications(notifications) {
  const notificationList = document.getElementById("notificationList");
  if (!notificationList) return;
  
  if (notifications.length === 0) {
    notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
    return;
  }
  
  notificationList.innerHTML = notifications.map(notification => {
    const time = formatNotificationTime(notification.created_at);
    const unreadClass = !notification.is_read ? 'unread' : '';
    
    return `
      <div class="notification-item ${unreadClass}">
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">Time: ${time}</div>
      </div>
    `;
  }).join('');
}

function formatNotificationTime(createdAt) {
  const date = new Date(createdAt);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

async function markAllNotificationsAsRead() {
  if (user.role !== "admin" && user.role !== "dealer") return;
  
  try {
    const endpoint = user.role === "admin" ? "/api/admin/notifications/read" : "/api/dealer/notifications/read";
    const header = user.role === "admin" ? { "x-admin-id": user.id } : { "x-dealer-id": user.id };
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken,
        ...(user.role === "admin" ? { "x-admin-id": user.id } : { "x-dealer-id": user.id })
      }
    });
    
    if (!res.ok) throw new Error("Failed to mark notifications as read");
    
    const result = await res.json();
    console.log(`Marked ${result.markedAsRead} notifications as read`);
    
    // Reload notifications to update UI
    await loadNotifications();
    
  } catch (err) {
    console.error("Mark notifications read error:", err);
  }
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notificationDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
    
    // If opening, mark all as read
    if (dropdown.classList.contains("show")) {
      markAllNotificationsAsRead();
    }
  }
}

// Initialize notification system
function initNotificationSystem() {
  console.log("🚀 Initializing notification system for user:", user.role, user.id);
  
  if (user.role !== "admin" && user.role !== "dealer") {
    console.log("❌ User is not admin or dealer, notification system disabled");
    return;
  }
  
  console.log(`✅ ${user.role} user detected, setting up notifications`);
  
  // Load notifications on page load
  loadNotifications();
  
  // Set up polling for real-time updates (every 5 seconds)
  notificationPollingInterval = setInterval(() => {
    console.log("⏰ Polling for notifications...");
    loadNotifications();
  }, 5000);
  
  // Event listeners
  const notificationBell = document.getElementById("notificationBell");
  const markAllReadBtn = document.getElementById("markAllRead");
  
  if (notificationBell) {
    console.log("✅ Notification bell found, adding click listener");
    notificationBell.addEventListener("click", toggleNotificationDropdown);
  } else {
    console.log("❌ Notification bell element not found");
  }
  
  if (markAllReadBtn) {
    console.log("✅ Mark all read button found, adding click listener");
    markAllReadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      markAllNotificationsAsRead();
    });
  } else {
    console.log("❌ Mark all read button not found");
  }
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const notificationBell = document.getElementById("notificationBell");
    const dropdown = document.getElementById("notificationDropdown");
    
    if (notificationBell && dropdown && 
        !notificationBell.contains(e.target) && 
        !dropdown.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });
  
  console.log("🎉 Notification system initialized successfully");
}

// async function loadDashboard() {
//   try {
//     const res = await fetch("/api/dashboard");
//     if (!res.ok) throw new Error("Dashboard API failed");

//     const data = await res.json();

//     document.getElementById("totalAmount").innerText =
//       Number(data.disbursed_amount || 0).toLocaleString("en-IN");

//     document.getElementById("totalCases").innerText =
//       data.disbursed_cases || 0;

//   } catch (err) {
//     console.error(err);
//   }
// }


// async function loadBusinessType() {
//   const res = await fetch("/api/dashboard/business-type");
//   const data = await res.json();

//   const bar = document.getElementById("businessTypeBar");
//   bar.innerHTML = "";

//   if (!data.length) {
//     bar.innerHTML = "<p>No disbursed data</p>";
//     return;
//   }

//   const max = Math.max(...data.map(d => d.count));

//   data.forEach(row => {
//     const div = document.createElement("div");
//     div.className = "bar-fill";
//     div.style.width = (row.count / max) * 100 + "%";
//     div.textContent = `${row.loan_type} (${row.count})`;
//     bar.appendChild(div);
//   });
// }
async function loadDashboard() {
  try {
    let url = "";

    if (user.role === "admin") {
      url = `/api/dashboard/admin/${user.id}`;   // 👈 FIX
    } else {
      url = `/api/dashboard/${user.role}/${user.id}`;
    }

    const res = await fetch(url, {
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken
      }
    });
    if (!res.ok) throw new Error("Dashboard API failed");

    const data = await res.json();

    document.getElementById("totalAmount").innerText =
      Number(data.disbursed_amount || 0).toLocaleString("en-IN");

    document.getElementById("totalCases").innerText =
      data.disbursed_cases || 0;

  } catch (err) {
    console.error(err);
  }
}


async function loadBusinessType() {
  try {
    let url = "";

    if (user.role === "admin") {
      url = `/api/dashboard/admin/${user.id}/business-type`;  // 👈 FIX
    } else {
      url = `/api/dashboard/${user.role}/${user.id}/business-type`;
    }

    const res = await fetch(url, {
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken
      }
    });
    const data = await res.json();

    const bar = document.getElementById("businessTypeBar");
    bar.innerHTML = "";

    if (!data.length) {
      bar.innerHTML = "<p>No disbursed data</p>";
      return;
    }

    const max = Math.max(...data.map(d => d.count));

    data.forEach(row => {
      const div = document.createElement("div");
      div.className = "bar-fill";
      div.style.width = (row.count / max) * 100 + "%";
      div.textContent = `${row.loan_type} (${row.count})`;
      bar.appendChild(div);
    });

  } catch (err) {
    console.error(err);
  }
}


loadDashboard();
loadBusinessType();

// Initialize notification system
initNotificationSystem();

// Welcome Popup functionality
async function showWelcomePopup() {
  // Check if user is manager, employee, or dealer
  if (user && (user.role === 'manager' || user.role === 'employee' || user.role === 'dealer')) {
    // Check if this is the first visit (no welcome shown flag)
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    
    if (!welcomeShown) {
      const popup = document.getElementById('welcomePopup');
      const welcomeMessage = document.getElementById('welcomeMessage');
      
      if (popup && welcomeMessage) {
        // Fetch profile data to get user's name
        let displayName = user.username; // fallback to username
        try {
          const response = await fetch(`/api/user/${user.role}-info/${user.id}`, {
            headers: {
              'x-user-id': user.id,
              'x-session-token': user.sessionToken
            }
          });
          if (response.ok) {
            const profileData = await response.json();
            // Use first_name + last_name if available
            if (profileData.first_name || profileData.last_name) {
              displayName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
            } else if (profileData.dealer_name) {
              displayName = profileData.dealer_name;
            }
          }
        } catch (err) {
          console.log('Could not fetch profile for welcome message:', err);
        }
        
        // Set welcome message with name from profile
        welcomeMessage.textContent = `Welcome ${displayName}!`;
        
        // Show popup
        popup.style.display = 'flex';
        
        // Mark that welcome has been shown for this session
        sessionStorage.setItem('welcomeShown', 'true');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          closeWelcomePopup();
        }, 5000);
      }
    }
  }
}

function closeWelcomePopup() {
  const popup = document.getElementById('welcomePopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

// Show welcome popup after page loads
window.addEventListener('load', () => {
  setTimeout(showWelcomePopup, 1000); // Delay 1 second to ensure page is fully loaded
});

setInterval(() => {
  loadDashboard();
  loadBusinessType();
  loadBestEmployee();
}, 5000);

// Load Best Employee Data
async function loadBestEmployee() {
  try {
    const nameEl = document.getElementById("bestEmployeeName");
    const amountEl = document.getElementById("bestEmployeeAmount");
    const casesEl = document.getElementById("bestEmployeeCases");
    const cardEl = document.getElementById('bestEmployeeCard');

    if (!nameEl || !amountEl || !casesEl || !cardEl) return;
    if (!user || !user.role || !user.id) return;

    const url = `/api/dashboard/${encodeURIComponent(user.role)}/${encodeURIComponent(user.id)}/best-employee`;
    const res = await fetch(url, {
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("🔍 Best employee API response:", data);
    if (!data || !data.name) {
      cardEl.innerHTML = `
        <div style="text-align: center; width: 100%;">
          <div class="avatar-placeholder">🏆</div>
          <h5>No Performance Data</h5>
          <p class="employee-role">No disbursed cases found</p>
        </div>
      `;
      return;
    }

    // Fetch profile data to get actual name instead of username
    let displayName = data.name; // fallback to username from API
    
    try {
      // The best employee ID is in employee_id field
      const bestEmployeeId = data.employee_id;
      
      if (bestEmployeeId) {
        const profileRes = await fetch(`/api/user/employee-info/${bestEmployeeId}`, {
          headers: {
            'x-user-id': user.id,
            'x-session-token': user.sessionToken
          }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.first_name || profileData.last_name) {
            displayName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
          }
        }
      }
    } catch (profileErr) {
      console.log('Could not fetch profile for best employee name:', profileErr);
    }

    // Real employee data with profile name
    nameEl.textContent = displayName;
    amountEl.textContent = Number(data.disbursed_amount || 0).toLocaleString("en-IN");
    casesEl.textContent = data.total_cases || 0;
  } catch (err) {
    console.error("💥 Error loading best employee data:", err);
    const bestEmployeeCard = document.getElementById('bestEmployeeCard');
    if (bestEmployeeCard) {
      bestEmployeeCard.innerHTML = `
        <div style="text-align: center; width: 100%;">
          <div class="avatar-placeholder">🏆</div>
          <h5>No Performance Data</h5>
          <p class="employee-role">Unable to load performance data</p>
        </div>
      `;
    }
  }
}

// Initial load of best employee data
loadBestEmployee();


