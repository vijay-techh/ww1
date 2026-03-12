const express = require("express");

const path = require("path");

const cors = require("cors");

require("dotenv").config();



const pool = require("./db");



const app = express();

app.use(cors());

app.use(express.json());



// Serve frontend static files

const FRONTEND_PATH = path.join(__dirname, "../frontend");

app.use(express.static(FRONTEND_PATH));



// ----------------- Utilities -----------------

<<<<<<< HEAD
=======
async function generateRTOCode() {
  const { rows } = await pool.query(`
    SELECT COUNT(*) FROM rto_profiles
  `);

  const count = Number(rows[0].count) + 1;
  return `RTO${String(count).padStart(4, "0")}`;
}
>>>>>>> 4299f37062d62e8ea28995eb3e79ee116cc8a3a9


function generateDealerCode() {

  const random = Math.floor(100000 + Math.random() * 900000);

  return "DLR" + random;   // example: DLR483920

}



function generateLoanId() {

  return Date.now().toString(); // simple unique id

}



//viji 29/26



// ----------------- Dashboard -----------------

// app.get("/api/dashboard", async (req, res) => {

//   try {

//     const { rows } = await pool.query(`

//       SELECT

//         COUNT(*) FILTER (WHERE stage = 'Disbursed') AS disbursed_cases,

//         COALESCE(

//           SUM(NULLIF(data->>'disbursedSanctionLoanAmount', '')::numeric),

//           0

//         ) AS disbursed_amount

//       FROM leads

//       WHERE stage = 'Disbursed'

//     `);



//     res.json(rows[0] || { disbursed_cases: 0, disbursed_amount: 0 });

//   } catch (err) {

//     console.error("Dashboard error:", err);

//     res.status(500).json({ error: "Dashboard failed" });

//   }

// });

// ----------------- ROLE BASED DASHBOARD -----------------

app.get("/api/dashboard/:role/:userId", async (req, res) => {

  try {

    const { role, userId } = req.params;

    const uid = Number(userId);



    let query = "";

    let params = [];



    /* ================= ADMIN ================= */

    if (role === "admin") {

      query = `

        SELECT

          COUNT(*) FILTER (WHERE stage = 'Disbursed') AS disbursed_cases,

          COALESCE(

            SUM(NULLIF(data->>'disbursedSanctionLoanAmount', '')::numeric),

            0

          ) AS disbursed_amount

        FROM leads

        WHERE stage = 'Disbursed'

      `;

    }



    /* ================= MANAGER ================= */

    else if (role === "manager") {

      query = `

        SELECT

          COUNT(*) FILTER (WHERE stage = 'Disbursed') AS disbursed_cases,

          COALESCE(

            SUM(NULLIF(data->>'disbursedSanctionLoanAmount', '')::numeric),

            0

          ) AS disbursed_amount

        FROM leads

        WHERE stage = 'Disbursed'

        AND (

          created_by = $1

          OR created_by IN (

            SELECT employee_id FROM manager_employees WHERE manager_id = $1

          )

          OR created_by IN (

            SELECT dealer_id FROM employee_dealers 

            WHERE employee_id IN (

              SELECT employee_id FROM manager_employees WHERE manager_id = $1

            )

          )

        )

      `;

      params = [uid];

    }



    /* ================= EMPLOYEE ================= */

    else if (role === "employee") {

      query = `

        SELECT

          COUNT(*) FILTER (WHERE stage = 'Disbursed') AS disbursed_cases,

          COALESCE(

            SUM(NULLIF(data->>'disbursedSanctionLoanAmount', '')::numeric),

            0

          ) AS disbursed_amount

        FROM leads

        WHERE stage = 'Disbursed'

        AND (

          created_by = $1

          OR created_by IN (

            SELECT dealer_id FROM employee_dealers WHERE employee_id = $1

          )

        )

      `;

      params = [uid];

    }



    /* ================= DEALER ================= */

    else if (role === "dealer") {

      query = `

        SELECT

          COUNT(*) FILTER (WHERE stage = 'Disbursed') AS disbursed_cases,

          COALESCE(

            SUM(NULLIF(data->>'disbursedSanctionLoanAmount', '')::numeric),

            0

          ) AS disbursed_amount

        FROM leads

        WHERE stage = 'Disbursed'

        AND created_by = $1

      `;

      params = [uid];

    }



    const { rows } = await pool.query(query, params);

    res.json(rows[0] || { disbursed_cases: 0, disbursed_amount: 0 });



  } catch (err) {

    console.error("ROLE DASHBOARD ERROR:", err);

    res.status(500).json({ error: "Dashboard failed" });

  }

});



app.get("/api/dashboard/:role/:userId/best-employee", async (req, res) => {

  try {

    const { role, userId } = req.params;

    const uid = Number(userId);



    if (!uid || Number.isNaN(uid)) {

      return res.status(400).json({ error: "Invalid userId" });

    }



    let scopeFilterSql = "";

    let params = [];



    if (role === "admin") {

      params = [];

      scopeFilterSql = "";

    } else if (role === "manager") {

      params = [uid];

      scopeFilterSql = "WHERE employee_id IN (SELECT employee_id FROM manager_employees WHERE manager_id = $1)";

    } else if (role === "employee") {

      params = [uid];

      scopeFilterSql = "WHERE employee_id = $1";

    } else {

      return res.status(403).json({ error: "Role not allowed" });

    }



    const { rows } = await pool.query(

      `WITH disbursed_leads AS (

         SELECT

           l.created_by,

           COALESCE(NULLIF(l.data->>'disbursedSanctionLoanAmount', ''), '0')::numeric AS amount

         FROM leads l

         WHERE l.stage = 'Disbursed'

       ), lead_owner AS (

         SELECT

           dl.amount,

           CASE

             WHEN u.role = 'employee' THEN u.id

             WHEN u.role = 'dealer' THEN (

               SELECT ed.employee_id FROM employee_dealers ed WHERE ed.dealer_id = u.id LIMIT 1

             )

             ELSE NULL

           END AS employee_id

         FROM disbursed_leads dl

         JOIN users u ON u.id = dl.created_by

         WHERE u.deleted_at IS NULL

       ), employee_agg AS (

         SELECT

           employee_id,

           SUM(amount) AS disbursed_amount,

           COUNT(*) AS total_cases

         FROM lead_owner

         WHERE employee_id IS NOT NULL

         GROUP BY employee_id

       )

       SELECT

         ea.employee_id,

         u.username AS name,

         ea.disbursed_amount,

         ea.total_cases

       FROM employee_agg ea

       JOIN users u ON u.id = ea.employee_id

       ${scopeFilterSql}

       ORDER BY ea.disbursed_amount DESC

       LIMIT 1;`,

      params

    );



    if (!rows.length) {

      return res.json(null);

    }



    res.json(rows[0]);

  } catch (err) {

    console.error("BEST EMPLOYEE ERROR:", err);

    res.status(500).json({ error: "Failed to fetch best employee" });

  }

});



//viji 29/26

// app.get("/api/dashboard/business-type", async (req, res) => {

//   try {

//     const { rows } = await pool.query(`

//       SELECT loan_type, COUNT(*) AS count

//       FROM leads

//       WHERE stage = 'Disbursed'

//       GROUP BY loan_type

//       ORDER BY count DESC

//     `);

//     res.json(rows);

//   } catch (err) {

//     console.error(err);

//     res.status(500).json([]);

//   }

// });





app.get("/api/dashboard/:role/:userId/business-type", async (req, res) => {

  try {

    const { role, userId } = req.params;

    const uid = Number(userId);



    let query = "";

    let params = [];



    if (role === "admin") {

      query = `

        SELECT loan_type, COUNT(*) AS count

        FROM leads

        WHERE stage = 'Disbursed'

        GROUP BY loan_type

        ORDER BY count DESC

      `;

    }



    else if (role === "manager") {

      query = `

        SELECT loan_type, COUNT(*) AS count

        FROM leads

        WHERE stage = 'Disbursed'

        AND (

          created_by = $1

          OR created_by IN (

            SELECT employee_id FROM manager_employees WHERE manager_id = $1

          )

          OR created_by IN (

            SELECT dealer_id FROM employee_dealers 

            WHERE employee_id IN (

              SELECT employee_id FROM manager_employees WHERE manager_id = $1

            )

          )

        )

        GROUP BY loan_type

        ORDER BY count DESC

      `;

      params = [uid];

    }



    else if (role === "employee") {

      query = `

        SELECT loan_type, COUNT(*) AS count

        FROM leads

        WHERE stage = 'Disbursed'

        AND (

          created_by = $1

          OR created_by IN (

            SELECT dealer_id FROM employee_dealers WHERE employee_id = $1

          )

        )

        GROUP BY loan_type

        ORDER BY count DESC

      `;

      params = [uid];

    }



    else if (role === "dealer") {

      query = `

        SELECT loan_type, COUNT(*) AS count

        FROM leads

        WHERE stage = 'Disbursed'

        AND created_by = $1

        GROUP BY loan_type

        ORDER BY count DESC

      `;

      params = [uid];

    }



    const { rows } = await pool.query(query, params);

    res.json(rows);



  } catch (err) {

    console.error("ROLE BUSINESS TYPE ERROR:", err);

    res.status(500).json([]);

  }

});















app.get("/api/manager/stats", async (req, res) => {

  try {

    const { managerId } = req.query;



    const { rows } = await pool.query(`

      SELECT u.username, COUNT(l.loan_id) AS lead_count

      FROM users u

      LEFT JOIN leads l ON l.created_by = u.id

      WHERE u.id IN (

        SELECT child_id FROM manager_employees WHERE parent_id = $1

      )

      GROUP BY u.username

      ORDER BY lead_count DESC

    `, [managerId]);



    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json([]);

  }

});











// ----------------- Auth (temporary) -----------------

app.post("/api/login", async (req, res) => {

  try {

    const { username, password } = req.body;



    const { rows } = await pool.query(

      `SELECT id, username, role, status FROM users WHERE username=$1 AND password=$2 AND status='active' AND deleted_at IS NULL`,

      [username, password]

    );



    if (!rows.length) return res.status(401).json({ error: "Invalid credentials or account disabled" });



    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [rows[0].id]);



    res.json({ id: rows[0].id, username: rows[0].username, role: rows[0].role });

  } catch (err) {

    console.error("Login error:", err);

    res.status(500).json({ error: "Login failed" });

  }

});



// ----------------- Loan ID -----------------

app.get("/api/next-loan-id", (req, res) => {

  res.json({ loanId: generateLoanId() });

});



// ----------------- Users (public) -----------------

app.post("/api/users", async (req, res) => {

  try {

    const { username, password } = req.body;

    await pool.query("INSERT INTO users (username, password, role) VALUES ($1,$2,'employee')", [username, password]);

    res.json({ success: true });

  } catch (err) {

    console.error("Create user error:", err);

    res.status(500).json({ error: "Failed to create user" });

  }

});



app.delete("/api/users/:id", async (req, res) => {

  try {

    await pool.query("UPDATE users SET deleted_at = NOW(), status = 'inactive' WHERE id=$1", [req.params.id]);

    res.json({ success: true });

  } catch (err) {

    console.error("Delete user error:", err);

    res.status(500).json({ error: "Failed to delete user" });

  }

});



app.get("/api/users/:id", async (req, res) => {

  try {

    const userId = parseInt(req.params.id);

    if (!userId) return res.status(400).json({ error: "Invalid user ID" });

    

    const { rows } = await pool.query(`

      SELECT id, username, role, display_name, email, phone, status, created_at 

      FROM users 

      WHERE id = $1 AND deleted_at IS NULL

    `, [userId]);

    

    if (rows.length === 0) {

      return res.status(404).json({ error: "User not found" });

    }

    

    res.json(rows[0]);

  } catch (err) {

    console.error("Get user error:", err);

    res.status(500).json({ error: "Failed to fetch user" });

  }

});



// ----------------- Leads -----------------

app.post("/api/leads", async (req, res) => {

  try {

    const userId = Number(req.body.userId);

    

    // HARD VALIDATION - Never allow NULL created_by

    if (!userId || isNaN(userId)) {

      console.error("INVALID userId:", req.body.userId);

      return res.status(400).json({

        success: false,

        error: "Valid userId required"

      });

    }



    const loanId = generateLoanId();

    

    console.log("CREATING LEAD:", {

      loanId,

      userId,

      role: req.body.role,

      loanType: req.body.loanType,

      stage: req.body.loanStage || "Lead"

    });



    // 🎯 DEALER LEAD ASSIGNMENT: Auto-assign dealer leads to employees/managers

    let leadData = req.body;

    if (req.body.role === 'dealer') {

      try {

        console.log("🎯 Dealer lead detected, finding assignment...");

        

        // Find available employees/managers to assign the lead to

        // Strategy: Find any active employee or manager

        const assignmentResult = await pool.query(

          `SELECT id, role FROM users 

           WHERE role IN ('employee', 'manager') 

           AND status = 'active' 

           AND deleted_at IS NULL 

           ORDER BY role DESC, last_login DESC NULLS LAST

           LIMIT 1`,

          []

        );

        

        if (assignmentResult.rows.length > 0) {

          const assignedTo = assignmentResult.rows[0];

          leadData.assignedTo = assignedTo.id.toString();

          console.log(`✅ Dealer lead ${loanId} assigned to ${assignedTo.role} ID: ${assignedTo.id}`);

        } else {

          console.log("⚠️ No active employees/managers found for assignment");

        }

      } catch (assignErr) {

        console.error("❌ Dealer lead assignment error:", assignErr);

        // Continue without assignment if error occurs

      }

    }



    // Insert lead with proper created_by and assignment data

    await pool.query(

      `INSERT INTO leads (loan_id, loan_type, stage, data, created_by) 

       VALUES ($1, $2, $3, $4, $5)`,

      [

        loanId,

        req.body.loanType,

        req.body.loanStage || "Lead",

        leadData,  // Use modified leadData with assignment

        userId  // Always populated, never NULL

      ]

    );



    console.log("LEAD CREATED SUCCESSFULLY:", loanId);



    // NOTIFICATION SYSTEM: Create notifications for admins if creator is employee or manager

    // DEALER NOTIFICATION: Notify assigned employee/manager

    try {

      console.log(" Starting notification creation process...");

      

      // Get creator details

      const creatorResult = await pool.query(

        "SELECT username, role FROM users WHERE id = $1 AND deleted_at IS NULL",

        [userId]

      );

      

      console.log("Creator query result:", creatorResult.rows);

      

      if (creatorResult.rows.length > 0) {

        const creator = creatorResult.rows[0];

        console.log("Creator found:", creator);

        

        // DEALER LEAD NOTIFICATION: Notify assigned employee/manager

        if (creator.role === 'dealer' && leadData.assignedTo) {

          console.log(" Dealer lead with assignment, notifying assigned user...");

          

          const assignedUserResult = await pool.query(

            "SELECT username, role FROM users WHERE id = $1 AND deleted_at IS NULL",

            [leadData.assignedTo]

          );

          

          if (assignedUserResult.rows.length > 0) {

            const assignedUser = assignedUserResult.rows[0];

            const notificationMessage = `New dealer lead ${loanId} assigned to you from ${creator.username}`;

            

            await pool.query(

              `INSERT INTO notifications (user_id, message, is_read, created_at, type) 

               VALUES ($1, $2, false, NOW(), 'dealer_lead_assigned')`,

              [leadData.assignedTo, notificationMessage]

            );

            

            console.log(` Notified ${assignedUser.role} ${assignedUser.username}: ${notificationMessage}`);

          }

        }

        // Regular notification for employees and managers

        else if (creator.role === 'employee' || creator.role === 'manager') {

          console.log(" Creator is employee/manager, creating notifications...");

          

          // Get all admin users

          const adminsResult = await pool.query(

            "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL"

          );

          

          console.log("Admin users found:", adminsResult.rows.length);

          

          if (adminsResult.rows.length > 0) {

            const notificationMessage = `${creator.username} (${creator.role}) created lead ${loanId}`;

            console.log("Notification message:", notificationMessage);

            

            // Insert notification for each admin

            for (const admin of adminsResult.rows) {

              console.log(`Creating notification for admin ${admin.id}`);

              await pool.query(

                `INSERT INTO notifications (user_id, message, is_read, created_at, type) 

                 VALUES ($1, $2, false, NOW(), 'lead_created')`,

                [admin.id, notificationMessage]

              );

            }

            

            console.log(` Created notifications for ${adminsResult.rows.length} admins: ${notificationMessage}`);

          } else {

            console.log(" No admin users found");

          }

        } else {

          console.log(` Creator is ${creator.role}, not creating notifications`);

        }

      } else {

        console.log(" Creator not found in database");

      }

    } catch (notificationErr) {

      console.error(" NOTIFICATION CREATION ERROR:", notificationErr);

      // Don't fail the lead creation if notification fails

    }



    res.status(201).json({ success: true, loanId });



  } catch (err) {

    console.error("LEAD CREATION ERROR:", err);

    res.status(500).json({ 

      success: false,

      error: "Failed to create lead" 

    });

  }

});



app.get("/api/leads/:loanId", async (req, res) => {

  try {

    const { loanId } = req.params;

    const result = await pool.query("SELECT * FROM leads WHERE loan_id = $1", [loanId]);

    if (!result.rows.length) return res.status(404).json({ success: false });

    res.json(result.rows[0]);

  } catch (err) {

    console.error("Get lead error:", err);

    res.status(500).json({ success: false });

  }

});



app.put("/api/leads/:loanId", async (req, res) => {

  try {

    const { loanId } = req.params;

    await pool.query(`UPDATE leads SET stage = $1, data = $2 WHERE loan_id = $3`, [req.body.loanStage || "Lead", req.body, loanId]);

    res.json({ success: true });

  } catch (err) {

    console.error("Update lead error:", err);

    res.status(500).json({ error: "Failed to update lead" });

  }

});



app.get("/api/leads", async (req, res) => {

  try {

    const userId = Number(req.query.userId);

    const role = req.query.role;



    if (!userId || !role) {

      return res.status(400).json({ error: "userId and role required" });

    }



    let query = "";

    let params = [];



    /* ================= ADMIN ================= */

    if (role === "admin") {

      query = `

SELECT 

 l.*,

 u.role as creator_role,



 -- manager of employee

 (SELECT manager_id FROM manager_employees WHERE employee_id = l.created_by LIMIT 1) as manager_id,



 -- employee of dealer

 (SELECT employee_id FROM employee_dealers WHERE dealer_id = l.created_by LIMIT 1) as employee_id



FROM leads l

LEFT JOIN users u ON u.id = l.created_by



      `;

    }



    /* ================= MANAGER ================= */

else if (role === "manager") {

  query = `

    SELECT 

      l.*,

      u.role as creator_role,

      u.username as creator_name

    FROM leads l

    LEFT JOIN users u ON u.id = l.created_by

    WHERE

      l.created_by = $1



      OR l.created_by IN (

        SELECT employee_id

        FROM manager_employees

        WHERE manager_id = $1

      )



      OR l.created_by IN (

        SELECT dealer_id

        FROM employee_dealers

        WHERE employee_id IN (

          SELECT employee_id

          FROM manager_employees

          WHERE manager_id = $1

        )

      )

    ORDER BY l.created_at DESC

  `;

  params = [userId];

}





    /* ================= EMPLOYEE ================= */

    else if (role === "employee") {

      query = `

        SELECT *

        FROM leads

        WHERE

          -- own leads

          created_by = $1



          -- dealer leads assigned to employee

          OR created_by IN (

            SELECT dealer_id

            FROM employee_dealers

            WHERE employee_id = $1

          )

        ORDER BY created_at DESC

      `;

      params = [userId];

    }



    /* ================= DEALER ================= */

else if (role === "dealer") {

  query = `

    SELECT 

      l.*,

      u.role as creator_role,

      u.username as creator_name

    FROM leads l

    LEFT JOIN users u ON u.id = l.created_by

    WHERE l.created_by = $1

    ORDER BY l.created_at DESC

  `;

  params = [userId];

}





    const { rows } = await pool.query(query, params);

    res.json(rows);



  } catch (err) {

    console.error("Fetch leads error:", err);

    res.status(500).json({ error: "Failed to fetch leads" });

  }

});































app.delete("/api/leads/:loanId", async (req, res) => {

  try {

    const { loanId } = req.params;

    const result = await pool.query("DELETE FROM leads WHERE loan_id = $1", [loanId]);

    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });

    res.json({ success: true });

  } catch (err) {

    console.error('DELETE ERROR:', err);

    res.status(500).json({ success: false, error: 'Delete failed' });

  }

});



// ----------------- PINCODE validation -----------------

app.post("/api/validate-pincode", async (req, res) => {

  const { pincode, district } = req.body;

  if (!pincode) return res.status(400).json({ error: "Pincode required" });

  try {

    const r = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);

    const d = await r.json();

    if (d[0].Status !== "Success") return res.status(400).json({ error: "Invalid pincode" });

    const apiDistrict = d[0].PostOffice[0].District;

    if (district && apiDistrict.toLowerCase() !== district.toLowerCase()) {

      return res.status(400).json({ error: "PIN–District mismatch" });

    }

    res.json({ ok: true, district: apiDistrict });

  } catch (err) {

    console.error("Pincode validation error", err);

    res.status(500).json({ error: "Pincode validation failed" });

  }

});



// ----------------- Admin users -----------------

app.get("/api/admin/users", async (req, res) => {

  try {

    const adminId = parseInt(req.headers["x-admin-id"]);

    if (!adminId) return res.status(403).json({ error: "Unauthorized" });



    const adminCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [adminId]

    );



    if (!adminCheck.rows.length || adminCheck.rows[0].role !== "admin") {

      return res.status(403).json({ error: "Only admins may access this resource" });

    }



    const { rows } = await pool.query(`

SELECT

  u.id,

  u.username,

  u.password,

  u.role,

  u.status,

  u.last_login,



  mp.first_name,

  mp.last_name,

  mp.dob,

  mp.joining_date,

  mp.pan,

  mp.aadhar,

  mp.mobile,

  mp.father_mobile_no,

  mp.mother_mobile_no,

  mp.personal_email,

  mp.office_email,

  mp.location,

  mp.bank_name,

  mp.account_no,

  mp.ifsc,

  mp.bank_branch



FROM users u

LEFT JOIN manager_profiles mp ON mp.user_id = u.id

WHERE u.deleted_at IS NULL

ORDER BY u.id DESC;





    `);



    res.json(rows);

  } catch (err) {

    console.error("FETCH USERS ERROR:", err);

    res.status(500).json({ error: "Failed to fetch users" });

  }

});



// ----------------- Dealers list (admin/manager/employee) -----------------

app.get("/api/users/dealers", async (req, res) => {

  try {

    const userId = parseInt(req.headers["x-user-id"]);

    if (!userId) return res.status(403).json({ error: "Unauthorized" });



    const userCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [userId]

    );

    if (!userCheck.rows.length) return res.status(403).json({ error: "Unauthorized" });



    const role = (userCheck.rows[0].role || '').toLowerCase();

    if (!['admin', 'manager', 'employee'].includes(role)) {

      return res.status(403).json({ error: "Access denied" });

    }



    const { rows } = await pool.query(

      `SELECT

         u.id,

         u.username,

         u.status,

         COALESCE(dp.dealer_name, u.username) AS display_name

       FROM users u

       LEFT JOIN dealer_profiles dp ON dp.user_id = u.id

       WHERE u.role = 'dealer'

         AND u.deleted_at IS NULL

         AND (u.status IS NULL OR u.status <> 'inactive')

       ORDER BY COALESCE(dp.dealer_name, u.username)`

    );



    res.json(rows);

  } catch (err) {

    console.error("FETCH DEALERS ERROR:", err);

    res.status(500).json({ error: "Failed to fetch dealers" });

  }

});



//tharun

app.post("/api/admin/users", async (req, res) => {

  try {
<<<<<<< HEAD

    const { username, password, role, profile, employeeProfile } = req.body;
=======
const { username, password, role, profile, employeeProfile, rtoProfile } = req.body;
>>>>>>> 4299f37062d62e8ea28995eb3e79ee116cc8a3a9



    console.log("ADMIN CREATE USER:", req.body);



    if (!username || !password || !role) {

      return res.status(400).json({ error: "Missing fields" });

    }



    const roleNormalized = role.toLowerCase();
<<<<<<< HEAD

    const allowed = ["manager", "employee", "dealer"];
=======
const allowed = ["manager","employee","dealer","rto_agent"];
>>>>>>> 4299f37062d62e8ea28995eb3e79ee116cc8a3a9



    if (!allowed.includes(roleNormalized)) {

      return res.status(400).json({ error: "Invalid role" });

    }



    // if (roleNormalized === "manager") {

    //   if (!profile) {

    //     return res.status(400).json({ error: "Manager profile required" });

    //   }

    //   if (!profile.firstName || !profile.mobile || !profile.email) {

    //     return res.status(400).json({ error: "Incomplete manager profile" });

    //   }

    // }

if (roleNormalized === "manager") {

  if (

    !profile ||

    !profile.firstName ||

    !profile.mobile ||

    (!profile.personalEmail && !profile.officeEmail) ||

    !profile.bank ||

    !profile.bank.accountNo ||

    !profile.bank.ifsc ||

    !profile.bank.bankName

  ) {

    return res.status(400).json({ error: "Incomplete manager profile" });

  }

}





if (roleNormalized === "employee") {

  if (

    !employeeProfile ||

    !employeeProfile.employeeId ||

    !employeeProfile.firstName ||

    !employeeProfile.mobileNo ||

    !employeeProfile.bank ||

    !employeeProfile.bank.accountNo ||

    !employeeProfile.bank.ifsc

  ) {

    return res.status(400).json({ error: "Incomplete employee profile" });

  }

}





if (roleNormalized === "dealer") {

  if (

    !profile ||

    !profile.dealerName ||

    !profile.mobile ||

    !profile.bank ||

    !profile.bank.accountNo ||

    !profile.bank.ifsc ||

    !profile.bank.bankName

  ) {

    return res.status(400).json({ error: "Incomplete dealer profile" });

  }

}



    // Insert user

    const userRes = await pool.query(

      `INSERT INTO users (username, password, role, status)

       VALUES ($1, $2, $3, 'active')

       RETURNING id`,

      [username, password, roleNormalized]

    );



    const userId = userRes.rows[0].id;



    // Insert manager KYC if manager

    if (roleNormalized === "manager") {

      await pool.query(

  `INSERT INTO manager_profiles

  (

    user_id,

    first_name,

    last_name,

    dob,

    joining_date,

    pan,

    aadhar,

    mobile,

    father_mobile_no,

    mother_mobile_no,

    personal_email,

    office_email,

    location,

    account_no,

    ifsc,

    bank_name,

    bank_branch

  )

  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,

  [

    userId,

    profile.firstName,

    profile.lastName,

    profile.dob || null,

    profile.joiningDate || null,

    profile.pan,

    profile.aadhar,

    profile.mobile,

    profile.fatherMobile,

    profile.motherMobile,

    profile.personalEmail,

    profile.officeEmail,

    profile.location,

    profile.bank.accountNo,

    profile.bank.ifsc,

    profile.bank.bankName,

    profile.bank.bankBranch

  ]

);



    }

console.log("EMPLOYEE PROFILE INSERT:", employeeProfile);



    

    if (roleNormalized === "employee") {

  const empRes = await pool.query(

    `INSERT INTO employee_profiles

    (user_id, employee_id, first_name, last_name,

     pan_no, aadhar_no, dob, joining_date,

     mobile_no, father_mobile_no, mother_mobile_no,

     personal_email, office_email, location)

    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)

    RETURNING id`,

    [

      userId,

      employeeProfile.employeeId,

      employeeProfile.firstName,

      employeeProfile.lastName,

      employeeProfile.panNo,

      employeeProfile.aadharNo,

      employeeProfile.dob && employeeProfile.dob !== "" ? employeeProfile.dob : null,

      employeeProfile.joiningDate && employeeProfile.joiningDate !== "" ? employeeProfile.joiningDate : null,

      employeeProfile.mobileNo,

      employeeProfile.fatherMobileNo,

      employeeProfile.motherMobileNo,

      employeeProfile.personalEmail,

      employeeProfile.officeEmail,

      employeeProfile.location

    ]

  );



  const employeeProfileId = empRes.rows[0].id;



  await pool.query(

    `INSERT INTO employee_bank_details

     (employee_profile_id, account_no, ifsc, bank_name, bank_branch)

     VALUES ($1,$2,$3,$4,$5)`,

    [

      employeeProfileId,

      employeeProfile.bank.accountNo,

      employeeProfile.bank.ifsc,

      employeeProfile.bank.bankName,

      employeeProfile.bank.bankBranch

    ]

  );

}

// INSERT DEALER

// Insert dealer profile

if (roleNormalized === "dealer") {



  const dealerCode = generateDealerCode();



  const dealerRes = await pool.query(

    `INSERT INTO dealer_profiles

    (user_id, dealer_code, dealer_name, pan_no, aadhar_no, dob,

     mobile_no, father_mobile_no, mother_mobile_no,

     email, location)

    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)

    RETURNING id`,

    [

      userId,

      dealerCode,

      profile.dealerName,

      profile.pan,

      profile.aadhar,

      profile.dob || null,

      profile.mobile,

      profile.fatherMobile,

      profile.motherMobile,

      profile.email,

      profile.location

    ]

  );



  const dealerProfileId = dealerRes.rows[0].id;



  // Insert bank details

  await pool.query(

    `INSERT INTO dealer_bank_details

    (dealer_profile_id, account_no, ifsc, bank_name, bank_branch)

    VALUES ($1,$2,$3,$4,$5)`,

    [

      dealerProfileId,

      profile.bank.accountNo,

      profile.bank.ifsc,

      profile.bank.bankName,

      profile.bank.bankBranch

    ]

  );



  console.log("✅ Dealer created with code:", dealerCode);

}

if (roleNormalized === "rto_agent") {

  if (
    !rtoProfile ||
    !rtoProfile.firstName ||
    !rtoProfile.mobile ||
    !rtoProfile.bank ||
    !rtoProfile.bank.accountNo
  ) {
    return res.status(400).json({ error: "Incomplete RTO profile" });
  }

  await pool.query(`
    INSERT INTO rto_agent_profiles
    (user_id, first_name, last_name,
     pan_no, aadhar_no, dob, joining_date,
     mobile_no, father_mobile_no, mother_mobile_no,
     personal_email, office_email, location,
     account_no, ifsc, bank_name, bank_branch)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  `, [
    userId,
    rtoProfile.firstName,
    rtoProfile.lastName,
    rtoProfile.pan,
    rtoProfile.aadhar,
    rtoProfile.dob || null,
    rtoProfile.joiningDate || null,
    rtoProfile.mobile,
    rtoProfile.fatherMobile,
    rtoProfile.motherMobile,
    rtoProfile.personalEmail,
    rtoProfile.officeEmail,
    rtoProfile.location,
    rtoProfile.bank.accountNo,
    rtoProfile.bank.ifsc,
    rtoProfile.bank.bankName,
    rtoProfile.bank.bankBranch
  ]);

  console.log("✅ RTO agent profile created");
}






    res.json({ success: true });

    

} catch (err) {

  console.error("CREATE USER ERROR:", err);



  if (err.code === "23505") {

    return res.status(400).json({ error: "Username already exists" });

  }



  res.status(500).json({ error: "Failed to create user" });

}



});









app.patch("/api/admin/users/:id", async (req, res) => {

  try {

    const userId = parseInt(req.params.id);

    const adminId = parseInt(req.headers["x-admin-id"]);

    const { username, password } = req.body;



    if (!adminId) return res.status(403).json({ error: 'Unauthorized' });

    if (!username) return res.status(400).json({ error: 'Username required' });



    const adminRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [adminId]);

    if (!adminRes.rows.length || adminRes.rows[0].role !== 'admin') {

      return res.status(403).json({ error: 'Only admins may edit users' });

    }



    const userRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [userId]);

    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    

    // Prevent editing admin users

    if (userRes.rows[0].role === 'admin') {

      return res.status(403).json({ error: 'Admin users cannot be edited' });

    }



    // Check if username already exists for another user

    if (username) {

      const existingUser = await pool.query(

        "SELECT id FROM users WHERE username = $1 AND id != $2 AND deleted_at IS NULL",

        [username, userId]

      );

      if (existingUser.rows.length > 0) {

        return res.status(400).json({ error: 'Username already exists' });

      }

    }



    // Build update query dynamically

    let updateFields = [];

    let updateValues = [];

    let paramIndex = 1;



    if (username) {

      updateFields.push(`username = $${paramIndex++}`);

      updateValues.push(username);

    }



    if (password) {

      updateFields.push(`password = $${paramIndex++}`);

      updateValues.push(password);

    }



    if (updateFields.length === 0) {

      return res.status(400).json({ error: 'No fields to update' });

    }



    updateValues.push(userId); // Add userId for WHERE clause



    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;

    

    await pool.query(updateQuery, updateValues);



    res.json({ success: true });



  } catch (err) {

    console.error('Edit user error:', err);

    res.status(500).json({ error: 'Failed to edit user' });

  }

});



app.get("/api/admin/employee-info/:userId", async (req, res) => {

  try {

    const { userId } = req.params;



    const { rows } = await pool.query(`

      SELECT

        u.username,

        ep.employee_id,

        ep.first_name,

        ep.last_name,

        ep.pan_no,

        ep.aadhar_no,

        ep.dob,

        ep.joining_date,

        ep.mobile_no,

        ep.father_mobile_no,

        ep.mother_mobile_no,

        ep.personal_email,

        ep.office_email,

        ep.location,



        eb.account_no,

        eb.ifsc,

        eb.bank_name,

        eb.bank_branch

      FROM users u

      JOIN employee_profiles ep ON ep.user_id = u.id

      LEFT JOIN employee_bank_details eb ON eb.employee_profile_id = ep.id

      WHERE u.id = $1

    `, [userId]);



    if (!rows.length) {

      return res.status(404).json({ error: "Employee info not found" });

    }



    res.json(rows[0]);

  } catch (err) {

    console.error("EMPLOYEE INFO ERROR:", err);

    res.status(500).json({ error: "Failed to fetch employee info" });

  }

});

app.get("/api/admin/dealer-info/:userId", async (req, res) => {

  try {

    const { userId } = req.params;



    const { rows } = await pool.query(`

      SELECT 

        u.username,

        dp.dealer_code,

        dp.dealer_name,

        dp.pan_no,

        dp.aadhar_no,

        dp.dob,

        dp.mobile_no,

        dp.father_mobile_no,

        dp.mother_mobile_no,

        dp.email,

        dp.location,



        db.account_no,

        db.ifsc,

        db.bank_name,

        db.bank_branch



      FROM users u

      JOIN dealer_profiles dp ON dp.user_id = u.id

      LEFT JOIN dealer_bank_details db 

        ON db.dealer_profile_id = dp.id

      WHERE u.id = $1

    `, [userId]);



    if (!rows.length) {

      return res.status(404).json({ error: "Dealer not found" });

    }



    res.json(rows[0]);



  } catch (err) {

    console.error("DEALER INFO ERROR:", err);

    res.status(500).json({ error: "Failed to fetch dealer info" });

  }

});

app.get("/api/admin/rto-info/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT u.username, r.*
      FROM users u
      LEFT JOIN rto_agent_profiles r ON u.id = r.user_id
      WHERE u.id=$1
    `,[userId]);

    res.json(result.rows[0]);

  } catch(err){
    console.error(err);
    res.status(500).json({error:"Failed to fetch RTO info"});
  }
});






app.delete("/api/admin/users/:id", async (req, res) => {

  try {

    const userId = parseInt(req.params.id);

    const adminId = parseInt(req.headers["x-admin-id"]);



    // ... (rest of the code remains the same)

    if (!adminId) return res.status(403).json({ error: "Unauthorized" });

    if (userId === adminId) return res.status(400).json({ error: "You cannot delete your own account" });



    const userRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [userId]);

    if (!userRes.rows.length) return res.status(404).json({ error: "User not found" });

    const role = userRes.rows[0].role;



    // Prevent admin deleting himself

    if (userId === adminId) return res.status(400).json({ error: "You cannot delete your own account" });



    // Prevent admin deleting another admin

    if (role === 'admin') {

      const adminRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [adminId]);

      if (!adminRes.rows.length || adminRes.rows[0].role !== 'admin') {

        return res.status(403).json({ error: "Only admins can delete admin users" });

      }

      return res.status(403).json({ error: "Admin users cannot be deleted" });

    }



    // Soft delete the user

    await pool.query("UPDATE users SET deleted_at = NOW(), status = 'inactive' WHERE id = $1", [userId]);

    res.json({ success: true });

  } catch (err) {

    console.error("Delete user error:", err);

    res.status(500).json({ error: "Failed to delete user" });

  }

});



app.patch("/api/admin/users/:id/status", async (req, res) => {

  try {

    const userId = parseInt(req.params.id);

    const adminId = parseInt(req.headers["x-admin-id"]);

    const { status } = req.body; // expected 'active' or 'disabled'



    if (!adminId) return res.status(403).json({ error: 'Unauthorized' });

    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    if (userId === adminId) return res.status(400).json({ error: 'You cannot change your own status' });



    const adminRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [adminId]);

    if (!adminRes.rows.length || adminRes.rows[0].role !== 'admin') return res.status(403).json({ error: 'Only admins may change user status' });



    const userRes = await pool.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [userId]);

    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    if (userRes.rows[0].role === 'admin') return res.status(403).json({ error: 'Admin cannot be disabled' });



    await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, userId]);

    res.json({ success: true });

  } catch (err) {

    console.error('Status update error:', err);

    res.status(500).json({ error: 'Failed to update status' });

  }

});



app.post("/api/admin/assign-employee", async (req, res) => {

  try {

    const { parentId, childId, managerId, employeeId } = req.body;

    

    // Support both parameter naming conventions

    const finalManagerId = parentId || managerId;

    const finalEmployeeId = childId || employeeId;



    if (!finalManagerId || !finalEmployeeId) {

      return res.status(400).json({ error: "managerId & employeeId required" });

    }



    await pool.query(

      `INSERT INTO manager_employees (manager_id, employee_id)

        VALUES ($1, $2)

        ON CONFLICT (employee_id) DO UPDATE

        SET manager_id = EXCLUDED.manager_id;



`,

      [finalManagerId, finalEmployeeId]

    );



    res.json({ success: true });

  } catch (err) {

    console.error("Assign error:", err);

    res.status(500).json({ error: "Assignment failed" });

  }

});



app.get("/api/admin/manager-employees/:managerId", async (req, res) => {

  try {

    const { managerId } = req.params;



    const { rows } = await pool.query(

      "SELECT employee_id FROM manager_employees WHERE manager_id = $1",

      [managerId]

    );



    res.json(rows.map(r => r.employee_id));

  } catch (err) {

    console.error(err);

    res.status(500).json([]);

  }

});



































app.get("/api/admin/employee-dealers/:employeeId", async (req, res) => {

  try {

    const { employeeId } = req.params;



    const { rows } = await pool.query(`

      SELECT dealer_id

      FROM employee_dealers

      WHERE employee_id = $1

    `, [employeeId]);



    res.json(rows.map(r => r.dealer_id));

  } catch (err) {

    console.error(err);

    res.status(500).json([]);

  }

});

















































app.delete("/api/admin/unassign-employee", async (req, res) => {

  try {

    const { managerId, employeeId, parentId, childId } = req.body;

    

    // Support both parameter naming conventions

    const finalManagerId = managerId || parentId;

    const finalEmployeeId = employeeId || childId;

    

    console.log("Unassign request received:", { managerId: finalManagerId, employeeId: finalEmployeeId });



    // First check if the assignment exists

    const checkResult = await pool.query(

      "SELECT * FROM manager_employees WHERE manager_id = $1 AND employee_id = $2",

      [finalManagerId, finalEmployeeId]

    );

    

    console.log("Existing assignment check:", checkResult.rows);



    if (checkResult.rows.length === 0) {

      console.log("No assignment found to delete");

      return res.status(404).json({ error: "Assignment not found" });

    }



    const deleteResult = await pool.query(

      "DELETE FROM manager_employees WHERE manager_id = $1 AND employee_id = $2",

      [finalManagerId, finalEmployeeId]

    );



    console.log("Delete result:", deleteResult);



    res.json({ success: true, deleted: deleteResult.rowCount });

  } catch (err) {

    console.error("Unassign error:", err);

    res.status(500).json({ error: "Unassign failed" });

  }

});













app.post("/api/admin/assign-dealer", async (req, res) => {

  const { employeeId, dealerId } = req.body;



  if (!employeeId || !dealerId) {

    return res.status(400).json({ error: "Missing fields" });

  }



  await pool.query(

    `INSERT INTO employee_dealers (employee_id, dealer_id)

     VALUES ($1, $2)

     ON CONFLICT DO NOTHING`,

    [employeeId, dealerId]

  );



  res.json({ success: true });

});



app.delete("/api/admin/unassign-dealer", async (req, res) => {

  const { employeeId, dealerId } = req.body;



  await pool.query(

    `DELETE FROM employee_dealers

     WHERE employee_id = $1 AND dealer_id = $2`,

    [employeeId, dealerId]

  );



  res.json({ success: true });

});







// ----------------- Admin Notifications -----------------

app.get("/api/admin/notifications", async (req, res) => {

  try {

    const adminId = parseInt(req.headers["x-admin-id"]);

    if (!adminId) return res.status(403).json({ error: "Unauthorized" });



    // Validate admin

    const adminCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [adminId]

    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {

      return res.status(403).json({ error: "Admin access required" });

    }



    // Get notifications ordered by newest first

    const notificationsResult = await pool.query(

      `SELECT id, message, is_read, created_at, type 

       FROM notifications 

       WHERE user_id = $1 

       ORDER BY created_at DESC`,

      [adminId]

    );



    res.json({

      notifications: notificationsResult.rows,

      unreadCount: notificationsResult.rows.filter(n => !n.is_read).length

    });



  } catch (err) {

    console.error("Get notifications error:", err);

    res.status(500).json({ error: "Failed to get notifications" });

  }

});



app.post("/api/admin/notifications/read", async (req, res) => {

  try {

    const adminId = parseInt(req.headers["x-admin-id"]);

    if (!adminId) return res.status(403).json({ error: "Unauthorized" });



    // Validate admin

    const adminCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [adminId]

    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {

      return res.status(403).json({ error: "Admin access required" });

    }



    // Mark all notifications for this admin as read

    const result = await pool.query(

      `UPDATE notifications 

       SET is_read = true 

       WHERE user_id = $1 AND is_read = false`,

      [adminId]

    );



    res.json({ 

      success: true, 

      markedAsRead: result.rowCount 

    });



  } catch (err) {

    console.error("Mark notifications read error:", err);

    res.status(500).json({ error: "Failed to mark notifications as read" });

  }

});



// ----------------- KHATA SYSTEM -----------------



// Helper function to validate user role from database

async function validateUserRole(userId, requiredRole) {

  const result = await pool.query(

    "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

    [userId]

  );

  

  if (!result.rows.length) return false;

  

  if (requiredRole === 'admin') return result.rows[0].role === 'admin';

  if (requiredRole === 'dealer') return result.rows[0].role === 'dealer';

  if (requiredRole === 'manager') return result.rows[0].role === 'manager';

  

  return false;

}



// POST /api/khata/credit - Admin gives points to dealer

app.post("/api/khata/credit", async (req, res) => {

  try {

    const { dealerId, points, reason } = req.body;

    const adminId = parseInt(req.headers["x-admin-id"]);

    

    // Strict validation

    if (!adminId) return res.status(403).json({ error: "Admin authentication required" });

    if (!dealerId || !points || !reason) {

      return res.status(400).json({ error: "dealerId, points, and reason required" });

    }

    if (points <= 0) return res.status(400).json({ error: "Points must be greater than 0" });

    

    // Verify admin role from database (never trust frontend)

    const isAdmin = await validateUserRole(adminId, 'admin');

    if (!isAdmin) return res.status(403).json({ error: "Only admins can credit points" });

    

    // Verify dealer exists and is dealer role

    const dealerResult = await pool.query(

      "SELECT id, username FROM users WHERE id = $1 AND role = 'dealer' AND deleted_at IS NULL",

      [dealerId]

    );

    if (!dealerResult.rows.length) return res.status(404).json({ error: "Dealer not found" });

    

    // Insert credit transaction

    const insertResult = await pool.query(

      `INSERT INTO dealer_khata (dealer_id, points, type, reason, created_by)

       VALUES ($1, $2, 'credit', $3, $4)

       RETURNING id, created_at`,

      [dealerId, points, reason, adminId]

    );

    

    // Create notification for the dealer

    await pool.query(

      `INSERT INTO notifications (user_id, message, type)

       VALUES ($1, $2, $3)`,

      [

        dealerId,

        `Admin credited ${points} points to your account. Reason: ${reason}`,

        'khata_credit'

      ]

    );

    

    console.log(`✅ Admin ${adminId} credited ${points} points to dealer ${dealerId} (${dealerResult.rows[0].username})`);

    console.log(`🔔 Notification sent to dealer ${dealerId}`);

    

    res.json({ 

      success: true, 

      transactionId: insertResult.rows[0].id,

      message: `Credited ${points} points to ${dealerResult.rows[0].username}`

    });

    

  } catch (err) {

    console.error("KHATA CREDIT ERROR:", err);

    res.status(500).json({ error: "Failed to credit points" });

  }

});



// POST /api/khata/redeem - Dealer redeems their points

app.post("/api/khata/redeem", async (req, res) => {

  try {

    const { points, reason } = req.body;

    const dealerId = parseInt(req.headers["x-dealer-id"]);

    

    // Strict validation

    if (!dealerId) return res.status(403).json({ error: "Dealer authentication required" });

    if (!points || !reason) {

      return res.status(400).json({ error: "points and reason required" });

    }

    if (points <= 0) return res.status(400).json({ error: "Points must be greater than 0" });

    

    // Verify dealer role from database (never trust frontend)

    const isDealer = await validateUserRole(dealerId, 'dealer');

    if (!isDealer) return res.status(403).json({ error: "Only dealers can redeem points" });

    

    // Check sufficient balance

    const balanceResult = await pool.query(

      `SELECT 

        COALESCE(SUM(CASE WHEN type = 'credit' THEN points ELSE 0 END), 0) -

        COALESCE(SUM(CASE WHEN type = 'debit' THEN points ELSE 0 END), 0) AS balance

       FROM dealer_khata 

       WHERE dealer_id = $1`,

      [dealerId]

    );

    

    const currentBalance = parseInt(balanceResult.rows[0].balance) || 0;

    if (currentBalance < points) {

      return res.status(400).json({ 

        error: "Insufficient balance", 

        currentBalance,

        requestedPoints: points 

      });

    }

    

    // Insert debit transaction

    const insertResult = await pool.query(

      `INSERT INTO dealer_khata (dealer_id, points, type, reason, created_by)

       VALUES ($1, $2, 'debit', $3, $4)

       RETURNING id, created_at`,

      [dealerId, points, reason, dealerId]

    );

    

    console.log(`✅ Dealer ${dealerId} redeemed ${points} points`);

    

    res.json({ 

      success: true, 

      transactionId: insertResult.rows[0].id,

      pointsRedeemed: points,

      remainingBalance: currentBalance - points

    });

    

  } catch (err) {

    console.error("KHATA REDEEM ERROR:", err);

    res.status(500).json({ error: "Failed to redeem points" });

  }

});



// GET /api/khata - View khata records

app.get("/api/khata", async (req, res) => {

  try {

    const userId = parseInt(req.headers["x-user-id"]);

    const userRole = req.headers["x-user-role"];

    

    if (!userId || !userRole) {

      return res.status(400).json({ error: "User authentication required" });

    }

    

    // Verify role from database (never trust frontend)

    const actualRoleResult = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [userId]

    );

    

    if (!actualRoleResult.rows.length) return res.status(404).json({ error: "User not found" });

    const actualRole = actualRoleResult.rows[0].role;

    

    // Managers and employees are forbidden from khata routes

    if (actualRole === 'manager' || actualRole === 'employee') {

      return res.status(403).json({ error: "Managers and employees cannot access khata system" });

    }

    

    let query = "";

    let params = [];

    

    if (actualRole === 'admin') {

      // Admin sees all dealer khata records with dealer names

      query = `

        SELECT 

          dk.id,

          dk.dealer_id,

          u.username as dealer_username,

          dk.points,

          dk.type,

          dk.reason,

          dk.created_by,

          creator.username as created_by_name,

          dk.created_at

        FROM dealer_khata dk

        JOIN users u ON u.id = dk.dealer_id

        JOIN users creator ON creator.id = dk.created_by

        ORDER BY dk.created_at DESC

      `;

    } else if (actualRole === 'dealer') {

      // Dealer sees only their own records

      query = `

        SELECT 

          dk.id,

          dk.dealer_id,

          dk.points,

          dk.type,

          dk.reason,

          dk.created_by,

          creator.username as created_by_name,

          dk.created_at

        FROM dealer_khata dk

        JOIN users creator ON creator.id = dk.created_by

        WHERE dk.dealer_id = $1

        ORDER BY dk.created_at DESC

      `;

      params = [userId];

    } else {

      return res.status(403).json({ error: "Access denied" });

    }

    

    const { rows } = await pool.query(query, params);

    res.json(rows);

    

  } catch (err) {

    console.error("KHATA VIEW ERROR:", err);

    res.status(500).json({ error: "Failed to fetch khata records" });

  }

});



// GET /api/khata/balance - Get dealer balance

app.get("/api/khata/balance", async (req, res) => {

  try {

    const dealerId = parseInt(req.headers["x-dealer-id"]);

    

    if (!dealerId) return res.status(403).json({ error: "Dealer authentication required" });

    

    // Verify dealer role from database (never trust frontend)

    const isDealer = await validateUserRole(dealerId, 'dealer');

    if (!isDealer) return res.status(403).json({ error: "Only dealers can check balance" });

    

    // Calculate balance

    const balanceResult = await pool.query(

      `SELECT 

        COALESCE(SUM(CASE WHEN type = 'credit' THEN points ELSE 0 END), 0) -

        COALESCE(SUM(CASE WHEN type = 'debit' THEN points ELSE 0 END), 0) AS balance

       FROM dealer_khata 

       WHERE dealer_id = $1`,

      [dealerId]

    );

    

    const balance = parseInt(balanceResult.rows[0].balance) || 0;

    

    res.json({ balance });

    

  } catch (err) {

    console.error("KHATA BALANCE ERROR:", err);

    res.status(500).json({ error: "Failed to fetch balance" });

  }

});



// GET /api/khata/dealers - Get list of all dealers (for admin dropdown)

app.get("/api/khata/dealers", async (req, res) => {

  try {

    const adminId = parseInt(req.headers["x-admin-id"]);

    

    if (!adminId) return res.status(403).json({ error: "Admin authentication required" });

    

    // Verify admin role

    const isAdmin = await validateUserRole(adminId, 'admin');

    if (!isAdmin) return res.status(403).json({ error: "Admin access required" });

    

    // Get all active dealers with their proper names

    const { rows } = await pool.query(

      `SELECT 

         u.id, 

         u.username,

         COALESCE(ep.first_name || ' ' || ep.last_name, u.username) as display_name

       FROM users u

       LEFT JOIN employee_profiles ep ON ep.user_id = u.id

       WHERE u.role = 'dealer' AND u.deleted_at IS NULL 

       ORDER BY COALESCE(ep.first_name || ' ' || ep.last_name, u.username)`

    );

    

    res.json(rows);

    

  } catch (err) {

    console.error("KHATA DEALERS ERROR:", err);

    res.status(500).json({ error: "Failed to fetch dealers" });

  }

});



// GET /api/dealer/notifications - Get dealer notifications

app.get("/api/dealer/notifications", async (req, res) => {

  try {

    const dealerId = parseInt(req.headers["x-dealer-id"]);

    if (!dealerId) return res.status(403).json({ error: "Dealer authentication required" });



    // Validate dealer role

    const dealerCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [dealerId]

    );

    if (dealerCheck.rows.length === 0 || dealerCheck.rows[0].role !== 'dealer') {

      return res.status(403).json({ error: "Dealer access required" });

    }



    // Get notifications ordered by newest first

    const notificationsResult = await pool.query(

      `SELECT id, message, is_read, created_at, type 

       FROM notifications 

       WHERE user_id = $1 

       ORDER BY created_at DESC`,

      [dealerId]

    );



    res.json({

      notifications: notificationsResult.rows,

      unreadCount: notificationsResult.rows.filter(n => !n.is_read).length

    });



  } catch (err) {

    console.error("Get dealer notifications error:", err);

    res.status(500).json({ error: "Failed to get notifications" });

  }

});



// POST /api/dealer/notifications/read - Mark dealer notifications as read

app.post("/api/dealer/notifications/read", async (req, res) => {

  try {

    const dealerId = parseInt(req.headers["x-dealer-id"]);

    if (!dealerId) return res.status(403).json({ error: "Dealer authentication required" });



    // Validate dealer role

    const dealerCheck = await pool.query(

      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",

      [dealerId]

    );

    if (dealerCheck.rows.length === 0 || dealerCheck.rows[0].role !== 'dealer') {

      return res.status(403).json({ error: "Dealer access required" });

    }



    // Mark all notifications for this dealer as read

    const result = await pool.query(

      `UPDATE notifications 

       SET is_read = true 

       WHERE user_id = $1 AND is_read = false`,

      [dealerId]

    );



    res.json({ 

      success: true, 

      markedAsRead: result.rowCount 

    });



  } catch (err) {

    console.error("Mark dealer notifications read error:", err);

    res.status(500).json({ error: "Failed to mark notifications as read" });

  }

});

app.get("/api/all-users", async (req, res) => {

  try {

    const { rows } = await pool.query(`

      SELECT id, username, role FROM users

      WHERE deleted_at IS NULL AND status='active'

      ORDER BY username

    `);



    res.json(rows);

  } catch (err) {

    console.error("ALL USERS ERROR:", err);

    res.status(500).json({ error: "Failed to fetch all users" });

  }

});



// ================= USER PROFILE ENDPOINTS =================

app.get("/api/user/manager-info/:userId", async (req, res) => {

  try {

    const { userId } = req.params;



    const { rows } = await pool.query(`

      SELECT

        u.username,

        mp.first_name,

        mp.last_name,

        mp.dob,

        mp.joining_date,

        mp.pan,

        mp.aadhar,

        mp.mobile,

        mp.father_mobile_no,

        mp.mother_mobile_no,

        mp.personal_email,

        mp.office_email,

        mp.location,

        mp.account_no,

        mp.ifsc,

        mp.bank_name,

        mp.bank_branch

      FROM users u

      LEFT JOIN manager_profiles mp ON mp.user_id = u.id

      WHERE u.id = $1

    `, [userId]);



    if (!rows.length) {

      return res.status(404).json({ error: "Manager not found" });

    }



    res.json(rows[0]);



  } catch (err) {

    console.error("MANAGER PROFILE ERROR:", err);

    res.status(500).json({ error: "Failed to fetch manager profile" });

  }

});





app.get("/api/user/dealer-info/:userId", async (req, res) => {

  try {

    const { userId } = req.params;



    const { rows } = await pool.query(`

      SELECT 

        u.username,

        dp.dealer_code,

        dp.dealer_name,

        dp.pan_no,

        dp.aadhar_no,

        dp.dob,

        dp.mobile_no,

        dp.father_mobile_no,

        dp.mother_mobile_no,

        dp.email,

        dp.location,



        db.account_no,

        db.ifsc,

        db.bank_name,

        db.bank_branch



      FROM users u

      JOIN dealer_profiles dp ON dp.user_id = u.id

      LEFT JOIN dealer_bank_details db 

        ON db.dealer_profile_id = dp.id

      WHERE u.id = $1

    `, [userId]);



    if (!rows.length) {

      return res.status(404).json({ error: "Dealer not found" });

    }



    res.json(rows[0]);



  } catch (err) {

    console.error("DEALER INFO ERROR:", err);

    res.status(500).json({ error: "Failed to fetch dealer info" });

  }

});









// ================= DEALER SELF PROFILE =================

app.get("/api/user/dealer-info/:userId", async (req, res) => {

  try {

    const { userId } = req.params;



    const { rows } = await pool.query(`

      SELECT 

        dp.dealer_code,

        dp.dealer_name,

        dp.pan_no,

        dp.aadhar_no,

        dp.dob,

        dp.mobile_no,

        dp.father_mobile_no,

        dp.mother_mobile_no,

        dp.email,

        dp.location,



        db.account_no,

        db.ifsc,

        db.bank_name,

        db.bank_branch

      FROM dealer_profiles dp

      LEFT JOIN dealer_bank_details db 

        ON db.dealer_profile_id = dp.id

      WHERE dp.user_id = $1

    `, [userId]);



    if (!rows.length) {

      return res.status(404).json({ error: "Dealer profile not found" });

    }



    res.json(rows[0]);



  } catch (err) {

    console.error("DEALER PROFILE ERROR:", err);

    res.status(500).json({ error: "Failed to fetch dealer profile" });

  }

});









app.get("/api/user/dealer-info/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const result = await pool.query(

      "SELECT * FROM dealer_profiles WHERE user_id=$1",

      [id]

    );



    if (result.rows.length === 0) {

      return res.status(404).json({ error: "Dealer profile not found" });

    }



    res.json(result.rows[0]);

  } catch (err) {

    console.error("Dealer profile error:", err);

    res.status(500).json({ error: "Server error" });

  }

});



app.get("/api/user/manager-info/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const result = await pool.query(

      "SELECT * FROM manager_profiles WHERE user_id=$1",

      [id]

    );



    if (result.rows.length === 0) {

      return res.status(404).json({ error: "Manager profile not found" });

    }



    res.json(result.rows[0]);

  } catch (err) {

    console.error("Manager profile error:", err);

    res.status(500).json({ error: "Server error" });

  }

});



//ttt

/* ================= USER PROFILE (FINAL CLEAN) ================= */



// EMPLOYEE PROFILE

app.get("/api/user/employee-info/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const { rows } = await pool.query(`

      SELECT

        ep.employee_id,

        ep.first_name,

        ep.last_name,

        ep.pan_no,

        ep.aadhar_no,

        ep.dob,

        ep.joining_date,

        ep.mobile_no,

        ep.father_mobile_no,

        ep.mother_mobile_no,

        ep.personal_email,

        ep.office_email,

        ep.location,

        eb.account_no,

        eb.ifsc,

        eb.bank_name,

        eb.bank_branch

      FROM employee_profiles ep

      LEFT JOIN employee_bank_details eb 

        ON eb.employee_profile_id = ep.id

      WHERE ep.user_id = $1

    `,[id]);



    if (!rows.length) return res.status(404).json({ error:"Employee not found" });



    res.json(rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).json({error:"Server error"});

  }

});



// DEALER PROFILE

app.get("/api/user/dealer-info/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const { rows } = await pool.query(`

      SELECT 

        dp.dealer_code,

        dp.dealer_name,

        dp.pan_no,

        dp.aadhar_no,

        dp.dob,

        dp.mobile_no,

        dp.father_mobile_no,

        dp.mother_mobile_no,

        dp.email,

        dp.location,

        db.account_no,

        db.ifsc,

        db.bank_name,

        db.bank_branch

      FROM dealer_profiles dp

      LEFT JOIN dealer_bank_details db 

        ON db.dealer_profile_id = dp.id

      WHERE dp.user_id = $1

    `,[id]);



    if (!rows.length) return res.status(404).json({ error:"Dealer not found" });



    res.json(rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).json({error:"Server error"});

  }

});



// MANAGER PROFILE

app.get("/api/user/manager-info/:id", async (req, res) => {

  try {

    const { id } = req.params;



    const { rows } = await pool.query(`

      SELECT *

      FROM manager_profiles

      WHERE user_id = $1

    `,[id]);



    if (!rows.length) return res.status(404).json({ error:"Manager not found" });



    res.json(rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).json({error:"Server error"});

  }

});















// Start server in non-production; also export app for tests

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "production") {

  app.listen(PORT, () => console.log(`🚀 Running locally on http://localhost:${PORT}`));

}





module.exports = app;

// ... (rest of the code remains the same)