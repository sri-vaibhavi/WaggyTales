const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const mysql2 = require("mysql2");
const multer = require("multer");
const nodemailer = require("nodemailer");
const session = require('express-session');
const app = express();
require('dotenv').config();

// Middleware
app.use(express.static(path.join(__dirname, "static")));
app.use(express.static(path.join(__dirname, "Images")));
app.use(express.static(path.join(__dirname, "CSS")));
app.use("/uploads", express.static(path.join(__dirname, "Images")));
app.use(session({ secret: 'waggy', resave: false, saveUninitialized: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL Connection Pool (Better than createConnection)
const db = mysql2.createPool({
  host: "localhost",
  user: "root",
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Handle MySQL connection errors
db.on("error", (err) => {
  console.error("MySQL Connection Error:", err);
});

// Image Storage Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "waggyimages/Cat_images"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  
    }
});
const upload = multer({ storage: storage });

// Routes

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'html', 'dashboard.html'));
});

// API to get adopted and donated pets
app.get('/api/dashboard', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = req.session.user;
    const adoptedQuery = "SELECT p.pet_id, p.pet_name, p.status FROM adoption_requests a JOIN pet_details p ON a.pet_id = p.pet_id WHERE a.u_name = ?";
    const donatedQuery = "SELECT pet_id, pet_name, status FROM pet_details WHERE u_name = ?";

    db.query(adoptedQuery, [user], (err, adoptedPets) => {
        if (err) throw err;
        db.query(donatedQuery, [user], (err, donatedPets) => {
            if (err) throw err;
            res.json({ adoptedPets, donatedPets, user });
        });
    });
});

// Mark Pet as Adopted
app.post('/mark-adopted/:pet_id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    const petId = req.params.pet_id;
    const user = req.session.user;

    // Check if the logged-in user is the donor of this pet
    const checkOwnerQuery = "SELECT * FROM pet_details WHERE pet_id = ? AND u_name = ?";
    
    db.query(checkOwnerQuery, [petId, user], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(403).json({ error: 'You can only mark pets you donated as adopted' });
        }

        // If the user is the donor, update the status
        const updateQuery = "UPDATE pet_details SET status = 'Adopted' WHERE pet_id = ?";
        db.query(updateQuery, [petId], (err) => {
            if (err) {
                console.error("Error updating pet status:", err);
                return res.status(500).json({ error: 'Error updating pet status' });
            }
            res.json({ success: true, message: 'Pet marked as adopted' });
        });
    });
});

app.post("/dashboard-signin", (req, res) => {
    const { username, password } = req.body;

    const query = "SELECT * FROM user WHERE u_name = ? AND password = ?";
    db.query(query, [username, password], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.json({ success: false, message: "Database error" });
        }

        if (result.length > 0) {
            req.session.user = result[0].u_name;  // Store user in session
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Invalid Username or Password" });
        }
    });
});

// Middleware to check if user is logged in
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/dashboard-login");
    }
}

// Dashboard Route (Protected)
app.get("/dashboard", checkAuth, (req, res) => {
    res.send("Welcome to your Dashboard, " + req.session.user);
});

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) console.error("Logout error:", err);
        res.redirect("/dashboardd");
    });
});


// Handle Pet Donations
app.post("/donate", upload.single("imageUrl"), (req, res) => {
    console.log("Received Form Data:", req.body);
    console.log("Uploaded File:", req.file);
 
    const { u_name, pet_type, pet_name, owner_name, age, gender, State, colour, breed, trait, health, diet, reason } = req.body;
 
    if (!u_name || !pet_type || !pet_name || !req.file) {
      return res.status(400).send("All required fields, including a photo, must be provided.");
    }
 
    const imageUrl = req.file.filename;
 
    const query = `
      INSERT INTO pet_details (u_name, pet_type, pet_name, owner_name, age, gender, State, colour, breed, trait, health, diet, reason, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
 
    db.query(query, [u_name, pet_type, pet_name, owner_name, age, gender, State, colour, breed, trait, health, diet, reason, imageUrl], (err, result) => {
      if (err) {
        console.error("DATABASE ERROR:", err);
        return res.status(500).send("DATABASE ERROR");
      }
      res.send("Pet donation submitted successfully!");
    });
});

// Contact Form - Email Sending
app.post("/contact", async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS; 

    if (!emailUser || !emailPass) {
        console.error("Email configuration missing");
        return res.status(500).json({ error: "Email service is not properly configured." });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: emailUser,
                pass: emailPass // Ensure this is an App Password
            }
        });

        const mailData = {
            from: emailUser,
            to: email,
            subject: "Thank you for contacting us!",
            text: `Dear ${name},\n\nThanks for reaching out! We have received your query and will get back soon!\n\nBest Regards,\nWaggy Tales Team`
        };

        await transporter.sendMail(mailData);
        res.json({ success: true, message: "Email sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email." });
    }
});

const otpStore = {}; 

app.post("/signin", (req, res) => {
    console.log("Received /signin data:", req.body);
    const { username, password } = req.body;
    const redirectUrl = req.query.redirect || ''; // Get redirection parameter
    const petIdMatch = req.headers.referer ? req.headers.referer.match(/[?&]pet_id=(\d+)/) : null;
    const pet_id = petIdMatch ? petIdMatch[1] : null;

    console.log("Redirect URL:", redirectUrl);
    console.log("Extracted Pet ID:", pet_id);

    db.query("SELECT * FROM user WHERE u_name = ? AND password = ?", [username, password], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (result.length === 0) return res.status(400).json({ success: false, message: "Invalid username or password!" });

        const user = result[0];

        // ✅ Redirect to Donate Page if requested
        if (redirectUrl === 'donate') {
            return res.json({ success: true, redirect: '/donate' });
        }

        // ✅ Handle Adoption if Pet ID is provided
        if (pet_id && !isNaN(pet_id)) {
            const parsedPetId = parseInt(pet_id);

            db.query("INSERT INTO adoption_requests (u_name, pet_id) VALUES (?, ?)", [username, parsedPetId], (adoptionErr) => {
                if (adoptionErr) {
                    console.error("Error adding adoption request:", adoptionErr);
                    return res.status(500).json({ success: false, message: "Error processing adoption request." });
                }
                console.log("Adoption request added successfully!");

                db.query("UPDATE pet_details SET status = ? WHERE pet_id = ?", ["Pending", parsedPetId], (updateErr) => {
                    if (updateErr) console.error("Error updating pet status:", updateErr);
                });

                // ✅ Send Email to Pet Owner
                db.query("SELECT email FROM user u JOIN pet_details p ON u.u_name = p.u_name WHERE p.pet_id = ?", [parsedPetId], (emailErr, ownerResult) => {
                    if (!emailErr && ownerResult.length > 0) {
                        const ownerEmail = ownerResult[0].email;
                        const transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: 'waggytaless@gmail.com',
                                pass: 'prmw lftm uiyh kqxk'  
                            },
                            secure: true,
                        });
                        const ownerMailData = {
                            from: 'waggytaless@gmail.com',
                            to: ownerEmail,
                            subject: 'Adoption Request Notification',
                            text: `Your pet with ID ${parsedPetId} has received an adoption request from ${username}.
                            Adopter Details: \nUsername: ${user.u_name}\nPhone: ${user.p_no}\nEmail: ${user.email}`
                        };
                        transporter.sendMail(ownerMailData, (mailErr) => {
                            if (mailErr) console.error("Error sending email:", mailErr);
                        });
                    }
                });

                // ✅ Return JSON instead of redirect
                return res.json({ success: true, redirect: '/success' });
            });
        } else {
            // ✅ Default Redirect (If no adoption or donate request)
            return res.json({ success: true, redirect: '/success' });
        }
    });
});


app.post("/verify-otp", (req, res) => {
    console.log("Received /verify-otp data:", req.body);
    const { email, otp } = req.body;

    if (!otpStore[email]) {
        return res.status(400).json({ success: false, message: "OTP expired or invalid!" });
    }

    console.log("Stored OTP:", otpStore[email].otp, "Entered OTP:", otp);

    if (otpStore[email].otp.toString() === otp) {
        const { username, phone, password, pet_id } = otpStore[email];
        delete otpStore[email];

        db.query(
            "INSERT INTO user (u_name, email, p_no, password) VALUES (?, ?, ?, ?)",
            [username, email, phone, password],
            (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ success: false, message: "Error creating account." });
                }
                User = username;
                
                if (pet_id && !isNaN(pet_id)) {
                    const parsedPetId = parseInt(pet_id);
                    
                    db.query(
                        "INSERT INTO adoption_requests (u_name, pet_id) VALUES (?, ?)",
                        [username, parsedPetId],  
                        (adoptionErr, adoptionResults) => {
                            if (adoptionErr) {
                                console.error("Error adding adoption request:", adoptionErr);
                                return;
                            }
                            console.log("Adoption request added successfully!");
                            
                            db.query(
                                "UPDATE pet_details SET status = ? WHERE pet_id = ?",
                                ["Pending", parsedPetId],
                                (err, results) => {
                                    if (err) {
                                        console.error("Error updating pet status:", err);
                                    } else {
                                        console.log(`Pet status updated successfully! Rows affected: ${results.affectedRows}`);
                                    }
                                }
                            );
                            
                            db.query(
                                "SELECT email FROM user u JOIN pet_details p ON u.u_name = p.u_name WHERE p.pet_id = ?",
                                [parsedPetId],
                                (err, ownerResult) => {
                                    if (!err && ownerResult.length > 0) {
                                        const ownerEmail = ownerResult[0].email;
                                        const transporter = nodemailer.createTransport({
                                            service: 'gmail',
                                            auth: {
                                                user: 'waggytaless@gmail.com',
                                                pass: 'prmw lftm uiyh kqxk'  
                                            },
                                            secure: true,
                                        });
                                        const ownerMailData = {
                                            from: 'waggytaless@gmail.com',
                                            to: ownerEmail,
                                            subject: 'Adoption Request Notification',
                                            text: `Your pet with ID ${parsedPetId} has received an adoption request from ${username}.
                                                   Adopter Details: \nUsername: ${username}\nPhone: ${phone}\nEmail: ${email}`
                                        };
                                        transporter.sendMail(ownerMailData);
                                    }
                                }
                            );
                        }
                    );
                }

                return res.status(200).json({ success: true, message: "Sign-up successful!" });
            }
        );
    } else {
        return res.status(400).json({ success: false, message: "Invalid OTP!" });
    }
});


app.post("/signup", (req, res) => {
    console.log("Received /signup data:", req.body);
    const { username, email, phone, password } = req.body;
    const redirectUrl = req.query.redirect || '';
    console.log("Redirect URL:", redirectUrl);
    const petIdMatch = req.headers.referer ? req.headers.referer.match(/[?&]pet_id=(\d+)/) : null;
    const pet_id = petIdMatch ? petIdMatch[1] : null;

    console.log("Extracted Pet ID:", pet_id);

    if (!username || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    db.query("SELECT * FROM user WHERE u_name = ?", [username], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (result.length > 0) return res.status(400).json({ success: false, message: "Username already exists!" });

        const otp = Math.floor(100000 + Math.random() * 900000);
        otpStore[email] = { otp, username, phone, password, pet_id: pet_id || null };

        console.log("Generated OTP:", otp);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'waggytaless@gmail.com',
                pass: 'prmw lftm uiyh kqxk'  
            },
            secure: true,
        });

        const mailData = {
            from: 'waggytaless@gmail.com',
            to: email,
            subject: 'WaggyTales OTP Verification',
            text: `Thank You for choosing WaggyTales. Your OTP for verification is: ${otp}. It is valid for 5 minutes. 
            Best Regards \n Team WaggyTales.`
        };

        transporter.sendMail(mailData, (err) => {
            if (err) console.error("Email Error:", err);
        });

        return res.status(200).json({ success: true, message: "OTP sent to your email." });
    });
});



app.get('/pets', (req, res) => {
    let query = 'SELECT * FROM pet_details WHERE status = "Available"';
    let params = [];

    if (req.query.pet_type) {
        query += " AND pet_type = ?";
        params.push(req.query.pet_type);
    }

    if (req.query.location) {
        query += " AND State = ?";
        params.push(req.query.location);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching pets:', err);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results.length > 0 ? results : []);
    });
});

app.get('/pets/:id', (req, res) => {
    const petId = req.params.id;

    if (!petId || petId === "undefined") {
        return res.status(400).json({ error: "Invalid pet ID" });
    }

    db.query("SELECT * FROM pet_details WHERE pet_id = ?", [petId], (err, result) => {
        if (err) return res.status(500).json({ error: "Database query error" });
        if (result.length === 0) return res.status(404).json({ error: "Pet not found" });
        res.json(result[0]);
    });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "HTML", "home.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "HTML", "contact.html"));
});

app.get("/about-us", (req, res) => {
  res.sendFile(path.join(__dirname, "HTML", "about-us.html"));
});

app.get("/donate", (req, res) => {
    res.sendFile(path.join(__dirname, "HTML", "donate.html"));
});

app.get('/adopt', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'adoptlist.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'login.html')));
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'sample.html')));
app.get('/details', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'pet_details.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'success.html')));
app.get('/dashboardd', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'dashboard_sign.html')));

// Start Server (ONLY ONE app.listen)
const PORT = 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));