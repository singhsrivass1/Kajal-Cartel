# Kajal Cartel

Find your perfect bridal makeup artist in New Delhi.

## Live Website

You can view the live application here: [kajal-cartel.vercel.app](https://kajal-cartel.vercel.app/)

## The Idea

Planning a wedding is stressful enough without scrolling through hundreds of makeup artist profiles, trying to guess if they can recreate the specific look you want. We wanted to make finding the right artist as simple as sharing a picture.

Kajal Cartel was built during a 48-hour buildathon to solve this exact problem.

## What It Does

Kajal Cartel is a smart matching platform for bridal beauty. You upload a photo of the bridal look you love. Our system looks at the details in your photo, like the skin finish, the style of the eye makeup, and the color choices.

It then pairs you with top-tier makeup artists in New Delhi who specialize in that exact style. Instead of just giving you a name, the system tells you exactly why that artist is a good match for your specific photo.

## Key Features

* **Share your vision:** Upload any photo that captures your ideal wedding look.
* **Smart breakdown:** The system analyzes the specific makeup details in your photo to understand your style.
* **Curated matches:** Get a short list of verified artists who match your style, complete with clear reasons why they fit your vision.
* **Simple booking:** View the artist's full profile, get a price estimate, and request to book directly through the platform.

## Technology Stack

This platform is built using modern, fast, and reliable web technologies:

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Artificial Intelligence:** Google Gemini API
* **Database:** MongoDB
* **Styling and Animation:** Tailwind CSS and Framer Motion
* **Hosting:** Vercel

## How to Run This Project Locally

If you want to run this website on your own computer, follow these steps:

1. Download or clone this project folder to your computer.
2. Open your computer's terminal, navigate to the folder, and install the required files by typing:
```bash
npm install

```


3. Create a new text file named `.env.local` in the main folder. You need to add your personal connection keys for the Google AI and your database here:
```env
GEMINI_API_KEY=your_google_ai_key_here
MONGODB_URI=your_database_string_here

```


4. Load the initial artist profiles into your database by typing:
```bash
npx tsx src/lib/db/seed.ts

```


5. Start the website by typing:
```bash
npm run dev

```


6. Open your web browser and go to `http://localhost:3000` to see the site in action.
