const fs = require('fs');
const path = require('path');

// This creates the folder inside your Next.js public directory
const targetDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const fileNames = [
  // Heroes & Interiors
  "hero-01.png", "hero-02.png", "hero-03.png", "hero-04.png", "hero-05.png",
  "interior-01.png", "interior-02.png", "interior-03.png",
  
  // Artist Profiles
  "studio-noor-profile.png", "meher-atelier-profile.png", 
  "studio-aara-profile.png", "priya-bhandari-artistry-profile.png", 
  "the-riya-edit-profile.png", "kamakshi-and-co-profile.png", 
  "safiya-studio-profile.png", "the-malviya-bride-profile.png",
  
  // Artist Portfolios
  "studio-noor-portfolio-01.png", "studio-noor-portfolio-02.png", "studio-noor-portfolio-03.png",
  "meher-atelier-portfolio-01.png", "meher-atelier-portfolio-02.png", "meher-atelier-portfolio-03.png",
  "studio-aara-portfolio-01.png", "studio-aara-portfolio-02.png", "studio-aara-portfolio-03.png",
  "priya-bhandari-artistry-portfolio-01.png", "priya-bhandari-artistry-portfolio-02.png", "priya-bhandari-artistry-portfolio-03.png",
  "the-riya-edit-portfolio-01.png", "the-riya-edit-portfolio-02.png", "the-riya-edit-portfolio-03.png",
  "kamakshi-and-co-portfolio-01.png", "kamakshi-and-co-portfolio-02.png", "kamakshi-and-co-portfolio-03.png",
  "safiya-studio-portfolio-01.png", "safiya-studio-portfolio-02.png", "safiya-studio-portfolio-03.png",
  "the-malviya-bride-portfolio-01.png", "the-malviya-bride-portfolio-02.png", "the-malviya-bride-portfolio-03.png"
];

// Create empty placeholder files
fileNames.forEach(file => {
  fs.writeFileSync(path.join(targetDir, file), '');
});

console.log(`✅ Successfully created ${fileNames.length} placeholder files in /public/images/`);