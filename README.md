Here is the updated, production-ready `README.md`.

I have updated the Features, Tech Stack, and Local Setup sections to reflect the actual architecture we just deployed—including NextAuth, Resend, the Journey Dashboard, and the crucial environment variables and `--legacy-peer-deps` flags required to run the app without crashing.

---

# Kajal Cartel

Find your perfect bridal makeup artist in New Delhi.

## Live Website

You can view the live application here: [kajal-cartel.vercel.app](https://kajal-cartel.vercel.app/)

## The Idea

Planning a wedding is stressful enough without scrolling through hundreds of makeup artist profiles, trying to guess if they can recreate the specific look you want. We wanted to make finding the right artist as simple as sharing a picture.

Kajal Cartel was built during a 48-hour buildathon to solve this exact problem.

## What It Does

Kajal Cartel is a smart matching platform for bridal beauty. You upload a photo of the bridal look you love. Our system analyzes the details in your photo—like the skin finish, the style of the eye makeup, and the color choices.

It then pairs you with top-tier makeup artists in New Delhi who specialize in that exact style. Instead of just giving you a name, the system tells you exactly why that artist is a good match for your specific photo, allows you to save them to a personal dashboard, and enables direct booking requests.

## Key Features

* **AI-Powered Discovery:** Upload any photo that captures your ideal wedding look, and let our Gemini-powered engine analyze the aesthetic markers.
* **Curated Matches:** Get a shortlist of verified artists who match your style, complete with clear reasons why they fit your vision.
* **My Journey Dashboard:** Securely log in to save your favorite artists and track your bridal aesthetic journey.
* **Streamlined Booking:** View full artist portfolios, calculate price estimates dynamically, and request bookings directly.
* **Transactional Notifications:** Automated email confirmations sent instantly upon booking requests.

## Technology Stack

This platform is built using a modern, infrastructure-grade web stack:

* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Artificial Intelligence:** Google Gemini API
* **Database:** MongoDB & Mongoose
* **Authentication:** NextAuth.js (Google OAuth with JWT Sessions)
* **Email Infrastructure:** Resend API
* **Styling & Animation:** Tailwind CSS and Framer Motion
* **Hosting:** Vercel

## How to Run This Project Locally

If you want to run this website on your own computer, follow these steps:

1. Download or clone this project folder to your computer.
2. Open your terminal, navigate to the folder, and install the required dependencies. *(Note: We use the legacy flag to resolve known adapter conflicts between NextAuth and MongoDB v6).*

```bash
npm install --legacy-peer-deps

```

3. Create a new file named `.env.local` in the root folder. You need to provide the following keys for the infrastructure to work:

```env
# AI & Database
GEMINI_API_KEY=your_google_ai_key_here
MONGODB_URI=your_mongodb_connection_string

# Authentication (NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_32_character_string

# Google OAuth Provider
GOOGLE_CLIENT_ID=your_google_cloud_client_id
GOOGLE_CLIENT_SECRET=your_google_cloud_client_secret

# Email Infrastructure
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=your_verified_resend_email_address

```

4. Load the initial artist profiles into your database by running the seed script:

```bash
npx tsx src/lib/db/seed.ts

```

5. Start the local development server:

```bash
npm run dev

```

6. Open your web browser and navigate to `http://localhost:3000`.
