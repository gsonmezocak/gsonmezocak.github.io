import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const BACKEND_URL = "https://fuzzy-giggle-pjg9p6qjwvgf9w5-8002.app.github.dev";

let firebaseAuth;
let firestoreDb;

console.log("PROFILE.JS YÜKLENDİ");

async function startProfile() {
  try {
    console.log("Profile sayfası başlatılıyor...");
    const response = await fetch(`${BACKEND_URL}/get-firebase-configuration`);
    if (!response.ok) throw new Error("Config alınamadı");

    const config = await response.json();
    const app = initializeApp(config);
    firebaseAuth = getAuth(app);
    firestoreDb = getFirestore(app);

    setupLogout();
    listenAuthAndLoadProfile();
  } catch (err) {
    console.error("Profil başlatma hatası:", err);
    alert("Profile sayfası yüklenemedi. Backend'in çalıştığından emin ol.");
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById("logout-button");
  if (!logoutBtn) return;
  logoutBtn.onclick = async (e) => {
    e.preventDefault();
    try {
      await signOut(firebaseAuth);
      window.location.href = "index.html";
    } catch (err) {
      console.error("Çıkış hatası:", err);
    }
  };
}

function listenAuthAndLoadProfile() {
  onAuthStateChanged(firebaseAuth, async (user) => {
    console.log("Auth state (profile):", user);
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    // Email
    const emailEl = document.getElementById("profile-email");
    if (emailEl) emailEl.innerText = user.email || "-";

    const userRef = doc(firestoreDb, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      document.getElementById("profile-name").innerText = "Complete your profile";
      document.getElementById("profile-headline").innerText =
        "Upload your CV from the dashboard to let AI build this profile.";
      return;
    }

    const data = snap.data();
    console.log("Profil verisi Firestore'dan geldi:", data);
    fillProfileFromData(data);
  });
}

function fillProfileFromData(data) {
  const fullName = data.fullName || "Unnamed candidate";
  const headline = data.headline || "Add a headline from your CV";
  const location = data.location || "Location unknown";
  const seniority = data.seniority || "Not set";
  const summary = data.summary || "No AI summary yet. Upload or refresh your CV from the dashboard.";
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const expYears = data.experienceYears ?? null;
  const lastUpdated = data.lastCvUpdatedAt || null;

  // Header
  document.getElementById("profile-name").innerText = fullName;
  document.getElementById("profile-headline").innerText = headline;
  document.getElementById("profile-location").innerText = location;
  document.getElementById("profile-seniority").innerText = `Level: ${seniority}`;

  // Avatar initials
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  const avatarEl = document.getElementById("profile-avatar-initials");
  if (avatarEl) avatarEl.innerText = initials || "?";

  // About
  document.getElementById("profile-summary").innerText = summary;
  document.getElementById("profile-last-updated").innerText = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : "Never";

  // Skills
  const skillsWrap = document.getElementById("profile-skills");
  if (skillsWrap) {
    skillsWrap.innerHTML = "";
    skills.slice(0, 12).forEach((skill) => {
      const chip = document.createElement("span");
      chip.className = "skill-chip";
      chip.innerText = skill;
      skillsWrap.appendChild(chip);
    });
  }

  // Stats
  const expLabel = expYears != null ? `${expYears} yrs` : "n/a";
  document.getElementById("profile-experience").innerText = expLabel;
  document.getElementById("profile-skill-count").innerText = `${skills.length} skills`;
  const focus = headline || (skills[0] ? `Strong in ${skills[0]}` : "-");
  document.getElementById("profile-role-focus").innerText = focus;
}

startProfile();
