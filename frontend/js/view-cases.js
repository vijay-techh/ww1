// Check session validity on page load
if (window.sessionManager && !window.sessionManager.isSessionValid()) {
  window.sessionManager.logout(true, "Please login to access this page.");
}

const filterRole = document.getElementById("filterRole");
if (filterRole) filterRole.addEventListener("change", applyFilters);
const filterUser = document.getElementById("filterUser");
if (filterUser) filterUser.addEventListener("change", applyFilters);

let allUsers = [];

const user = JSON.parse(localStorage.getItem("user"));

/* 🟢 ADMIN ONLY: load users for filter dropdown */
if (user.role === "admin") {
  fetch("/api/all-users")
    .then(res => res.json())
    .then(users => {
      const roleSelect = document.getElementById("filterRole");
      const userSelect = document.getElementById("filterUser");

      roleSelect.addEventListener("change", () => {
        const role = roleSelect.value;
        const userSelect = document.getElementById("filterUser");
        
        // Show/hide user dropdown based on role selection
        if (role) {
          userSelect.style.display = "block";
        } else {
          userSelect.style.display = "none";
        }
        
        userSelect.innerHTML = '<option value="">Select User</option>';

        users
          .filter(u => !role || u.role === role)
          .forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = `${u.username} (${u.role})`;
            userSelect.appendChild(opt);
          });
      });
    });
}

const adminFilters = document.getElementById("adminFilters");

if (user.role === "admin") {
  if (adminFilters) adminFilters.style.display = "flex";
} else {
  if (adminFilters) adminFilters.style.display = "none";
}

// Check if admin is viewing another user's leads via query params
const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('userId');
const targetUsername = urlParams.get('username');
const targetRole = urlParams.get('role');
const dealerView = urlParams.get("dealerView");

let fetchUrl;

if (user.role === "admin" && targetUserId) {
  // Admin ALWAYS stays admin
  fetchUrl = `/api/leads?userId=${user.id}&role=admin&viewUser=${targetUserId}`;
} else {
  fetchUrl = `/api/leads?userId=${user.id}&role=${user.role}`;
}

fetch(fetchUrl)

  .then(res => res.json())
  .then(leads => {
    allLeads = leads;
    filteredLeads = leads.slice();
    populateStageFilter();
    renderTable();
    
    // Update heading if admin is viewing employee leads
    if (user.role === "admin" && targetUserId && targetRole === "employee") {
      const heading = document.getElementById("pageHeading");
      if (heading) {
        heading.textContent = `Leads created by: ${targetUsername}`;
      }
    }
  })
  .catch(err => console.error(err));


// const user = JSON.parse(localStorage.getItem("user"));

// const url =
//   user.role === "admin"
//     ? "/api/leads"
//     : `/api/leads?userId=${user.id}&role=${user.role}`;

// const res = await fetch(url);

// if (user.role !== "admin") {
//   alert("Access denied");
//   window.location.href = "/dashboard.html";
// }

console.log("View Cases JS loaded");

let allLeads = [];
let filteredLeads = [];
let currentPage = 1;
const paginationEl = document.getElementById("pagination");
const tbody = document.querySelector("#leadsTable tbody");
const searchInput = document.getElementById("searchInput");
const filterStage = document.getElementById("filterStage");
const rowsPerPageSelect = document.getElementById("rowsPerPage");
const refreshBtn = document.getElementById("refreshBtn");
const emptyState = document.getElementById("emptyState");

async function loadUsers(){
  const res = await fetch("/api/all-users");
  allUsers = await res.json();
}
loadUsers();
if(filterRole){
filterRole.addEventListener("change", () => {

  const role = filterRole.value;

  filterUser.innerHTML = `<option value="">Select User</option>`;

  if(!role) return;

  const users = allUsers.filter(u => u.role === role);

  users.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.username;
    filterUser.appendChild(opt);
  });

  applyFilters();
});
}



async function fetchLeads() {
  try {
    let fetchUrl;
    
    // Check if admin is viewing another user's leads via query params
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');
    const targetUsername = urlParams.get('username');
    const targetRole = urlParams.get('role');

    if (user.role === "admin" && targetUserId) {
      fetchUrl = `/api/leads?userId=${user.id}&role=admin&viewUser=${targetUserId}`;
    } else {
      fetchUrl = `/api/leads?userId=${user.id}&role=${user.role}`;
    }


    console.log("[FRONTEND DEBUG] Sending headers:", {
      userId: user.id,
      sessionToken: user.sessionToken ? user.sessionToken.substring(0, 8) + "..." : null
    });

    const res = await fetch(fetchUrl, {
      headers: {
        'x-user-id': user.id,
        'x-session-token': user.sessionToken
      }
    });

    const leads = await res.json();
    allLeads = Array.isArray(leads) ? leads : [];

    // 🟣 If employee clicked "Dealer Leads"
    if (user.role === "employee" && dealerView === "1") {
      filteredLeads = allLeads.filter(l => l.created_by != user.id);
    } else {
      filteredLeads = allLeads.slice();
    }

        if(user.role==="employee" && dealerView==="1"){
      const heading = document.getElementById("pageHeading");
      if(heading){
        heading.textContent = "Dealer Leads (Your Dealers)";
      }
    }


    populateStageFilter();
    renderTable();
    
    // Update heading if admin is viewing employee leads
    if (user.role === "admin" && targetUserId && targetRole === "employee") {
      const heading = document.getElementById("pageHeading");
      if (heading) {
        heading.textContent = `Leads created by: ${targetUsername}`;
      }
    }
  } catch (err) {
    console.error("Error loading leads:", err);
  }
}

function populateStageFilter() {
  if (!filterStage) return;
  const stages = new Set(allLeads.map(l => l.data?.loanStage).filter(Boolean));
  // clear except first option
  filterStage.querySelectorAll('option:not(:first-child)').forEach(n => n.remove());
  Array.from(stages).sort().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    filterStage.appendChild(opt);
  });
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts);
  return d.toLocaleString();
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function renderTable() {
  if (!tbody) return;
  const rowsPerPage = Number(rowsPerPageSelect.value) || 10;
  const start = (currentPage - 1) * rowsPerPage;
  const paged = filteredLeads.slice(start, start + rowsPerPage);
  const searchTerm = (searchInput.value || '').trim();

  tbody.innerHTML = "";
  if (paged.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  paged.forEach(lead => {
    const tr = document.createElement('tr');
    
    // Apply highlighting to key fields
    const loanId = highlightText(lead.loan_id || '-', searchTerm);
    const name = highlightText(lead.data?.name || '-', searchTerm);
    const mobile = highlightText(lead.data?.mobile || '-', searchTerm);
    const loanAmount = highlightText(lead.data?.loanAmount || '-', searchTerm);
    const bankFinance = highlightText(lead.data?.bankFinance || lead.data?.loanDsa || '-', searchTerm);
    const loanStage = highlightText(lead.data?.loanStage || '-', searchTerm);
    
    // Get Select Dealer and Ref Name / Mob No fields
    const selectDealer = highlightText(lead.data?.basicCaseDealerSelect || lead.data?.caseDealer || '-', searchTerm);
    const refNameMobile = highlightText(lead.data?.basicRefNameMobile || '-', searchTerm);
    
    // Get UTR payment information
    const payments = lead.data?.payments || [];
    let utrInfo = '-';
    if (payments.length > 0) {
      const firstPayment = payments[0];
      utrInfo = highlightText(
        `${firstPayment.amount || ''} | ${firstPayment.utrNo || ''} | ${firstPayment.date || ''}`.replace(' |  | ', '').trim() || '-', 
        searchTerm
      );
    }
    
    tr.innerHTML = `
      <td>${loanId}</td>
      <td>${name}</td>
      <td>${mobile}</td>
      <td>${loanAmount}</td>
      <td>${bankFinance}</td>
      <td>${selectDealer}</td>
      <td>${refNameMobile}</td>
      <td>${utrInfo}</td>
      <td>${loanStage}</td>
      <td>${formatDate(lead.updatedAt || lead.createdAt)}</td>
      <td class="actions">
        <a href="/used-car-loan.html?loanId=${loanId}&view=1" class="viewBtn">View</a>
        <a href="/used-car-loan.html?loanId=${lead.loan_id}">Edit</a>
        <button data-id="${lead.loan_id}" class="deleteBtn">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(rowsPerPage);
  attachRowHandlers();

  // clicking a table row (outside actions) should open edit form
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.actions')) return; // ignore clicks inside actions cell
      const id = row.querySelector('td')?.textContent?.trim();
      if (id) window.location.href = `/used-car-loan.html?loanId=${id}`;
    });
  });
}

function attachRowHandlers() {
  // view button removed; row-click opens the edit form now
  tbody.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (!confirm('Delete lead ' + id + '?')) return;
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': user.id,
            'x-session-token': user.sessionToken
          }
        });
        if (res.ok) {
          await fetchLeads();
        } else {
          alert('Delete failed');
        }
      } catch (err) { console.error(err); alert('Delete error'); }
    });
  });

  // 'View' now navigates to the edit page (same as Edit link)
}

function renderPagination(rowsPerPage) {
  if (!paginationEl) return;
  const total = filteredLeads.length;
  const pages = Math.max(1, Math.ceil(total / rowsPerPage));
  paginationEl.innerHTML = '';

  const prev = document.createElement('button'); prev.textContent = 'Prev';
  prev.disabled = currentPage <= 1;
  prev.addEventListener('click', () => { currentPage = Math.max(1, currentPage-1); renderTable(); });
  paginationEl.appendChild(prev);

  const info = document.createElement('div'); info.textContent = `Page ${currentPage} of ${pages} — ${total} leads`;
  paginationEl.appendChild(info);

  const next = document.createElement('button'); next.textContent = 'Next';
  next.disabled = currentPage >= pages;
  next.addEventListener('click', () => { currentPage = Math.min(pages, currentPage+1); renderTable(); });
  paginationEl.appendChild(next);
}

function applyFilters() {

  const q = (searchInput.value || '').trim().toLowerCase();
  const stage = filterStage.value;
  const roleFilter = filterRole ? filterRole.value : "";
  const userFilter = filterUser ? filterUser.value : "";

  filteredLeads = allLeads.filter(l => {
    const selectedUserId = filterUser?.value;

// If specific user selected
if (selectedUserId) {

  // show only that user's leads
  if (String(l.created_by) !== String(selectedUserId)) {
    
    // also include hierarchy
    if (
      String(l.manager_id) !== String(selectedUserId) &&
      String(l.employee_id) !== String(selectedUserId)
    ) {
      return false;
    }
  }
}


    // 🔵 ROLE DROPDOWN FILTER
    if (roleFilter && !userFilter) {
      if (l.creator_role !== roleFilter) return false;
    }

    // 🔵 SPECIFIC USER FILTER
    if (userFilter) {

      // MANAGER selected
      if (roleFilter === "manager") {
        if (
          l.created_by == userFilter ||   // manager own leads
          l.manager_id == userFilter      // employees under manager
        ) {
          return true;
        }
        return false;
      }

      // EMPLOYEE selected
      if (roleFilter === "employee") {
        if (
          l.created_by == userFilter || 
          l.employee_id == userFilter
        ) {
          return true;
        }
        return false;
      }

      // DEALER selected
      if (roleFilter === "dealer") {
        if (l.created_by == userFilter) return true;
        return false;
      }
    }

    // 🔵 STAGE FILTER
    if (stage && l.data?.loanStage !== stage) return false;

    // 🔵 SEARCH FILTER
    if (q) {
      const searchableText = JSON.stringify(l).toLowerCase();
      if (!searchableText.includes(q)) return false;
    }

    return true;
  });

  currentPage = 1;
  renderTable();
}


// const user = JSON.parse(localStorage.getItem("user"));

// fetch(`/api/leads?userId=${user.id}&role=${user.role}`)
//   .then(res => res.json())
//   .then(data => renderCases(data));

// Modal logic
const modalBackdrop = document.getElementById('leadModalBackdrop');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.getElementById('closeModal');
function openModal(lead) {
  if (!lead) return;
  modalContent.textContent = JSON.stringify(lead, null, 2);
  modalBackdrop.style.display = 'flex';
}

// Events
if (searchInput) searchInput.addEventListener('input', () => { applyFilters(); });
if (filterStage) filterStage.addEventListener('change', () => { applyFilters(); });
if (rowsPerPageSelect) rowsPerPageSelect.addEventListener('change', () => { currentPage = 1; renderTable(); });
if (refreshBtn) refreshBtn.addEventListener('click', () => fetchLeads());

if (filterRole) filterRole.addEventListener("change", applyFilters);

// initial load
fetchLeads();
