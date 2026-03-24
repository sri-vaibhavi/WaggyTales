🐾 WaggyTales – Pet Adoption Platform
📌 Overview
WaggyTales is a full-stack web application designed to simplify the pet adoption process by acting as a bridge between pet owners and adopters. The platform enables users to explore available pets, send adoption requests, and manage their adoption history through a personalized dashboard.

🚀 Features
🐶 Browse pets available for adoption
📄 View detailed pet information
❤️ Send adoption requests
👤 User authentication and login system
📊 User Dashboard to:
        View adoption history
        Track request status
        Mark pets as adopted
🔄 Real-time pet status updates (Available / Adopted)

🛠️ Tech Stack
Frontend:
    HTML
    CSS
    JavaScript

Backend:
    Node.js
    Express.js

Database:
    MySQL

🗂️ Database Structure
1. user
u_name (Primary Key) - Stores user details

2. pet_details
pet_id (Primary Key) - Stores pet information
status (Default: "Available")

3. adoption_requests
Links users (u_name) with pets (pet_id) - Stores adoption request data

⚙️ Installation & Setup

Clone the repository
git clone https://github.com/your-username/waggytales.git
cd waggytales

Install dependencies
npm install

Set up MySQL Database
Create a database

Import required tables (user, pet_details, adoption_requests)
Update your database credentials in index.js

Run the server
node index.js

Open in browser:

http://localhost:3000

📁 Project Structure
waggytales/
│
├── CSS/
│   ├── adoptlist.css
│   ├── dashboard.css
│   ├── dashboard_sign.css
│   ├── donate.css
│   ├── homestyle.css
│   ├── login.css
│   ├── pet_details.css
│   └── success.css
│
├── HTML/
│   ├── home.html
│   ├── adoptlist.html
│   ├── pet_details.html
│   ├── dashboard.html
│   ├── dashboard_sign.html
│   ├── login.html
│   ├── donate.html
│   ├── contact.html
│   ├── success.html
│   └── sample.html
│
├── Images/              # Image assets - ignored
├── node_modules/        # Dependencies - ignored
├── .env                 # Environment variables - ignored
├── .gitignore
├── index.js             # Main backend server
├── package.json
├── package-lock.json
└── README.md
