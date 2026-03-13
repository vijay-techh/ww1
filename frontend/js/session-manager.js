// Session management utility for single device login

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Get session token
function getSessionToken() {
  const user = getCurrentUser();
  return user ? user.sessionToken : null;
}

// Check if session is valid
function isSessionValid() {
  const user = getCurrentUser();
  return user && user.sessionToken && user.id;
}

// Clear session and redirect to login
function logout(redirect = true, message = "Session expired. Please login again.") {
  // Clear user data from localStorage
  localStorage.removeItem("user");
  
  // Clear any other session-related data
  localStorage.removeItem("sessionToken");
  
  // Show message if provided
  if (message) {
    alert(message);
  }
  
  // Redirect to login page
  if (redirect) {
    window.location.href = "/index.html";
  }
}

// Enhanced fetch function that includes session token and handles 401 errors
async function apiFetch(url, options = {}) {
  const user = getCurrentUser();
  
  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  
  // Add session token and user ID to headers if available
  if (user) {
    headers["x-user-id"] = user.id;
    headers["x-session-token"] = user.sessionToken;
    
    // Also add x-admin-id for admin routes
    if (user.role === "admin") {
      headers["x-admin-id"] = user.id;
    }
  }
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Handle 401/403 - Session expired or invalid
  if (response.status === 401 || response.status === 403) {
    const data = await response.json().catch(() => ({}));
    
    // Check if it's a session-related error
    if (data.error && (
      data.error.includes("Session expired") || 
      data.error.includes("Unauthorized") ||
      data.error.includes("session")
    )) {
      logout(true, data.error || "Your session has expired. Please login again.");
      throw new Error("Session expired");
    }
  }
  
  return response;
}

// Check session on page load - call this on all protected pages
function checkSession() {
  if (!isSessionValid()) {
    logout(true, "Please login to access this page.");
    return false;
  }
  return true;
}

// Periodic session check (every 30 seconds)
function startSessionMonitor(intervalMs = 30000) {
  setInterval(async () => {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
      // Verify session is still valid with server
      const response = await fetch("/api/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-session-token": user.sessionToken
        }
      });
      
      if (!response.ok) {
        logout(true, "Your session has been invalidated. Please login again.");
      }
    } catch (err) {
      console.error("Session check error:", err);
    }
  }, intervalMs);
}

// Logout function that calls server to clear session
async function serverLogout() {
  const user = getCurrentUser();
  
  if (user && user.sessionToken) {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-session-token": user.sessionToken
        }
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  }
  
  logout(true, "You have been logged out.");
}

// Export functions for use in other scripts
window.sessionManager = {
  getCurrentUser,
  getSessionToken,
  isSessionValid,
  logout,
  apiFetch,
  checkSession,
  startSessionMonitor,
  serverLogout
};
