# RentControl — Device Rental Management System

An enterprise-grade rental fleet management platform with:
- **Customer Database**: Manage active, suspended, or blacklisted clients.
- **Device Fleet Inventory**: Filter by Android / iOS platform status.
- **Billing & Ledger Tracking**: Manual invoice generation & bank transaction reference receipts.
- **APNs & Apple Business Manager DEP Integration Skeleton**: Issues `DeviceLock` and `ClearPasscode` MDM commands.
- **Google Android Management API Integration Skeleton**: Kiosk-mode enforcement & remote locks via IssueCommand requests.
- **Daily Automated Scheduler**: Overnight cron checks. Grace periods lock/unlock handsets instantly based on ledger status.

---

## Technical Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind-Free Premium Dark Glassmorphism CSS + ChartJS.
- **Backend**: NestJS (TypeScript) + Mongoose + JWT Auth Guard.
- **Cache & Message Broker**: Redis.
- **Databases**: MongoDB.

---

## Repository Structure

```
rental/
├── backend/          # NestJS API codebase
│   ├── src/
│   │   ├── auth/          # JWT Guard & sign-ins
│   │   ├── customers/     # Customer CRM
│   │   ├── devices/       # Fleet list & spec configs
│   │   ├── rentals/       # Contract assignments & device releases
│   │   ├── payments/      # Billing ledgers & auto-generation rules
│   │   ├── reminders/     # SMTP Email warning templates
│   │   ├── scheduler/     # Daily cron checks (lock & unlock engines)
│   │   └── android-mdm/   # Google Management API v1 endpoint client
│   │   └── apple-mdm/     # APNs push sender & Device checkin server
├── frontend/         # Next.js Dashboard Client
├── docker-compose.yml# Local MongoDB + Mongo Express GUI + Redis services
└── README.md
```

---

## Quick Start (Local Development)

### 1. Prerequisite Environment Files
Create `.env` inside the `backend/` folder. Use the template provided in the root `.env.example`:
```bash
cp .env.example backend/.env
```

### 2. Launch DB & Cache Services
Spin up local MongoDB and Redis instances using Docker:
```bash
docker-compose up -d
```
*Tip: Mongo Express will be available at [http://localhost:8081](http://localhost:8081) for database inspection.*

### 3. Initialize & Start the Backend API
Navigate to the backend, download dynamic libraries, and start the development server:
```bash
cd backend
npm install
npm run start:dev
```
The NestJS API will boot up on [http://localhost:3001](http://localhost:3001).

### 4. Create the First Admin Account
Send an HTTP POST request to initialize your credentials:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rentcontrol.com","password":"yourpassword","name":"Super Admin"}'
```

### 5. Launch the Next.js Frontend Dashboard
Open a new terminal session, navigate to the frontend directory, and run the developer server:
```bash
cd frontend
npm install
npm run dev
```
The glassmorphism admin dashboard is accessible on [http://localhost:3000](http://localhost:3000). Log in with the registered credentials above.

---

## Automated Grace Period Lock Engine

The automated daily payment scheduler checks billing ledgers every day at **08:00 AM**:
1. If a payment is overdue but within the grace period (e.g. `< 3 days`), it dispatches an email reminder.
2. If a payment is overdue past the grace period (e.g. `>= 3 days`), it calls the respective MDM module to remote lock the handset.
3. If a ledger is paid off, the system automatically detects this and triggers a remote unlock command.

You can manually trigger the payment checker at any time by clicking the **"Run Payment Check"** button in the dashboard top-right.

---

## Configuring MDM Integrations

### For Android Enterprise
1. Create a service account in your Google Cloud Console.
2. Enable **Android Management API**.
3. Download the service account JSON key file and set the `ANDROID_SERVICE_ACCOUNT_KEY_JSON` string in `backend/.env`.
4. Enter your Android Enterprise ID into the dashboard Settings page or `.env`.

### For Apple iOS (iPhones/iPads)
1. Enroll as an Apple Enterprise MDM Vendor.
2. Obtain a valid MDM Push Certificate (.pem) matching your Apple Business Manager topic.
3. Place `mdm_push_cert.pem` and `mdm_push_key.pem` in `backend/certs/`.
4. Devices enrolled in Apple Business Manager under your DEP profile will check in to `/api/mdm/apple/checkin` and request instructions from `/api/mdm/apple/commands/:udid`.
# rental
# rental
