import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const BACKEND_URL = "https://fuzzy-giggle-pjg9p6qjwvgf9w5-8002.app.github.dev"; 

let firebaseAuthentication;
let cloudFirestore;

async function startDashboard() {
    try {
        console.log("Dashboard başlatılıyor...");
        const response = await fetch(`${BACKEND_URL}/get-firebase-configuration`);
        
        if (!response.ok) throw new Error("Config sunucudan alınamadı.");
        
        const secureConfig = await response.json();

        const app = initializeApp(secureConfig);
        firebaseAuthentication = getAuth(app);
        cloudFirestore = getFirestore(app);

        listenToAuthState();
        setupCVUploadListener();

    } catch (error) {
        console.error("Başlatma Hatası:", error);
        alert("Sistem yüklenemedi. Backend sunucusunun çalıştığından emin olun.");
    }
}

function listenToAuthState() {
    onAuthStateChanged(firebaseAuthentication, async (user) => {
        if (user) {
            const emailDisplay = document.getElementById('user-email-display');
            if (emailDisplay) emailDisplay.innerText = user.email;
            
            activateLogoutLogic();

            try {
                const userRef = doc(cloudFirestore, "users", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
    const userData = userSnap.data();
    const roleBadge = document.getElementById('user-role-badge');
    const displayNameEl = document.getElementById('display-name');

    if (roleBadge) roleBadge.innerText = userData.role;

    // Firestore'dan gelen isim (CV analizinden doldurmuştuk)
    const fullName = userData.fullName || userData.email || "there";

    if (displayNameEl) {
            displayNameEl.innerText = `Hello, ${fullName}!`;
        }
    }

                } catch (fsError) {
                    console.error("Firestore Error:", fsError.message);
                    // Firestore hatası olsa bile CV analizine engel değil, sadece logla
                }
            } else {
                window.location.replace("index.html");
            }
        });
    }

function activateLogoutLogic() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            try {
                await signOut(firebaseAuthentication);
            } catch (error) {
                console.error("Çıkış hatası:", error);
            }
        };
    }
}

function setupCVUploadListener() {
    const cvInput = document.getElementById('cv-upload');
    const aiResultDiv = document.getElementById('ai-result');

    if (cvInput) {
        cvInput.addEventListener('change', async (event) => {
            const selectedFile = event.target.files[0];
            if (!selectedFile) return;

            if (selectedFile.type !== "application/pdf") {
                alert("Please upload a PDF file.");
                return;
            }

            aiResultDiv.style.display = "block";
            aiResultDiv.innerHTML = "<em><i class='fas fa-spinner fa-spin'></i> Analyzing CV...</em>";

            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await fetch(`${BACKEND_URL}/analyze-cv`, {
                    method: 'POST',
                    body: formData
                });

                const resultData = await response.json();

                if (response.ok && resultData.status === 'success') {
                    // 1) Sağ panelde sonucu göster
                    const profile = resultData.profile || {};
                    const raw = resultData.raw_analysis || resultData.analysis || "";

                    aiResultDiv.innerHTML = `
                        <div style="background:#f0f9ff; border-left:5px solid #0ea5e9; padding:20px; border-radius:8px;">
                            <h4 style="color:#0369a1; margin-top:0;"><i class='fas fa-robot'></i> AI Analysis Result</h4>
                            <div style="margin-bottom:10px;">
                                <strong>Extracted profile:</strong><br>
                                Name: ${profile.full_name || "-"}<br>
                                Headline: ${profile.headline || "-"}<br>
                                Location: ${profile.location || "-"}<br>
                                Skills: ${(profile.skills || []).join(", ") || "-"}
                            </div>
                            <hr>
                            <div style="white-space: pre-wrap; font-size: 0.85rem;">${raw}</div>
                        </div>
                    `;

                    // 2) Profil verisini Firestore'daki users/{uid} dokümanına kaydet
                    try {
                        const auth = firebaseAuthentication;
                        const currentUser = auth.currentUser;
                        if (currentUser && cloudFirestore) {
                            const userRef = doc(cloudFirestore, "users", currentUser.uid);

                            const profileUpdate = {
                                fullName: profile.full_name || null,
                                headline: profile.headline || null,
                                location: profile.location || null,
                                skills: profile.skills || [],
                                experienceYears: profile.experience_years || null,
                                seniority: profile.seniority || null,
                                summary: profile.summary || null,
                                lastCvUpdatedAt: new Date().toISOString()
                            };

                            // Önce doküman var mı diye bak
                            const existingSnap = await getDoc(userRef);

                            if (existingSnap.exists()) {
                                // Varsa sadece güncelle
                                await updateDoc(userRef, profileUpdate);
                                console.log("Profil Firestore'a (updateDoc) kaydedildi");
                            } else {
                                // Yoksa yeni doküman oluştur (email/role varsa koru)
                                const baseData = {
                                    email: currentUser.email || null
                                };
                                await setDoc(userRef, { ...baseData, ...profileUpdate }, { merge: true });
                                console.log("Profil Firestore'a (setDoc) ile ilk kez kaydedildi");
                            }
                        } else {
                            console.warn("Kullanıcı yok veya Firestore hazır değil, profil kaydedilemedi.");
                        }
                    } catch (saveError) {
                        console.error("Profil Firestore'a yazılırken hata:", saveError);
                    }
                }
 
                else {
                    // Backend'den gelen spesifik hata mesajını göster
                    throw new Error(resultData.detail || "Server failed to process the PDF.");
                }

            } catch (error) {
                console.error("Analiz hatası:", error);
                aiResultDiv.innerHTML = `<span style="color:red;"><i class="fas fa-exclamation-triangle"></i> Error: ${error.message}</span>`;
            }
        });
    }
}

startDashboard();