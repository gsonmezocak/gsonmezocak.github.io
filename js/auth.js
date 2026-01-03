import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Global değişkenleri tanımlıyoruz
let firebaseAuthenticationInstance;
let cloudFirestoreDatabaseInstance;
let userSelectedRole = 'jobseeker';
let currentAuthenticationMode = 'login';

// Backend URL'nizi burada tanımlıyoruz. 
// NOT: Codespaces portunuzun PUBLIC olduğundan emin olun.
// DİKKAT: Portu 8002 olarak güncelledik
const BACKEND_URL = "https://fuzzy-giggle-pjg9p6qjwvgf9w5-8002.app.github.dev";

/**
 * Uygulama başladığında backend'den Firebase yapılandırmasını güvenli bir şekilde çeker.
 */
async function startSecureApplication() {
    try {
        console.log("Güvenli sunucuya bağlanılıyor:", BACKEND_URL);
        
        // Backend sunucusuna istek atıyoruz
        const configurationResponse = await fetch(`${BACKEND_URL}/get-firebase-configuration`, {
            method: 'GET',
            mode: 'cors', // CORS modunu açıkça belirtiyoruz
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Yanıtın başarılı olup olmadığını kontrol ediyoruz
        if (!configurationResponse.ok) {
            throw new Error(`Sunucu hatası: ${configurationResponse.status} - ${configurationResponse.statusText}`);
        }

        // Yapılandırma verisini alıyoruz
        const secureFirebaseConfiguration = await configurationResponse.json();
        console.log("Firebase yapılandırması başarıyla alındı.");

        // Firebase'i başlatıyoruz
        const firebaseApp = initializeApp(secureFirebaseConfiguration);
        firebaseAuthenticationInstance = getAuth(firebaseApp);
        cloudFirestoreDatabaseInstance = getFirestore(firebaseApp);

        console.log("Firebase bağlantısı başarılı!");
        
        // Kullanıcı arayüzü olaylarını başlatıyoruz
        initializeUserInterfaceEvents();

    } catch (connectionError) {
        // Hata detaylarını konsola yazdırıyoruz ve kullanıcıyı uyarıyoruz
        console.error("Bağlantı Hatası Detayları:", connectionError);
        alert(`Güvenli sunucuya bağlanılamadı. Lütfen backend sunucusunun (8001 portu) çalıştığından ve PUBLIC olduğundan emin olun.\n\nHata: ${connectionError.message}`);
    }
}

/**
 * Giriş ve Kayıt formu olaylarını yönetir.
 */
function initializeUserInterfaceEvents() {
    const authenticationForm = document.getElementById('auth-form');
    const toggleModeLink = document.getElementById('toggle-auth-link');

    // Rol seçimi fonksiyonu (Global olarak tanımlıyoruz)
    window.setRole = (role) => {
        userSelectedRole = role;
        document.getElementById('btn-jobseeker').classList.toggle('active', role === 'jobseeker');
        document.getElementById('btn-recruiter').classList.toggle('active', role === 'recruiter');
    };

    // Giriş/Kayıt modu değiştirme
    if (toggleModeLink) {
        toggleModeLink.addEventListener('click', (event) => {
            event.preventDefault();
            const formTitle = document.getElementById('form-title');
            const submitBtn = document.getElementById('submit-btn');
            const toggleText = document.getElementById('toggle-text');

            if (currentAuthenticationMode === 'login') {
                currentAuthenticationMode = 'register';
                formTitle.innerText = "Create your account";
                submitBtn.innerText = "Sign Up";
                toggleText.innerHTML = 'Do you have an account? <a href="#" id="toggle-auth-link">Sign In</a>';
            } else {
                currentAuthenticationMode = 'login';
                formTitle.innerText = "Welcome Back";
                submitBtn.innerText = "Sign In";
                toggleText.innerHTML = 'Don\'t have an account? <a href="#" id="toggle-auth-link">Create Account</a>';
            }
        });
    }

    // Form gönderim işlemi
    authenticationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (currentAuthenticationMode === 'register') {
            try {
                // Yeni kullanıcı kaydı
                const userCredential = await createUserWithEmailAndPassword(firebaseAuthenticationInstance, email, password);
                
                // Kullanıcı bilgilerini Firestore'a kaydediyoruz
                await setDoc(doc(cloudFirestoreDatabaseInstance, "users", userCredential.user.uid), {
                    email: email,
                    role: userSelectedRole,
                    createdAt: new Date().toISOString()
                });

                // 1) Bilgilendirme
                alert("Hesabınız oluşturuldu. Şimdi e-posta ve şifrenizle giriş yapabilirsiniz.");

                // 2) Formu login moduna çevir
                currentAuthenticationMode = 'login';

                const formTitle = document.getElementById('form-title');
                const submitBtn = document.getElementById('submit-btn');
                const toggleText = document.getElementById('toggle-text');

                if (formTitle) formTitle.innerText = "Welcome Back";
                if (submitBtn) submitBtn.innerText = "Sign In";
                if (toggleText) {
                    toggleText.innerHTML = 'Don\'t have an account? <a href="#" id="toggle-auth-link">Create Account</a>';
                }

                // 3) Şifreyi temizle (email'i bırakalım ki tekrar yazmak zorunda kalmasın)
                document.getElementById('password').value = "";

                // 4) Toggle link için event'i yeniden bağla
                const newToggleLink = document.getElementById('toggle-auth-link');
                if (newToggleLink) {
                    newToggleLink.addEventListener('click', (event) => {
                        event.preventDefault();
                        // login <-> register toggle mantığını tekrar kullan
                        if (currentAuthenticationMode === 'login') {
                            currentAuthenticationMode = 'register';
                            formTitle.innerText = "Create your account";
                            submitBtn.innerText = "Sign Up";
                            toggleText.innerHTML = 'Do you have an account? <a href="#" id="toggle-auth-link">Sign In</a>';
                        } else {
                            currentAuthenticationMode = 'login';
                            formTitle.innerText = "Welcome Back";
                            submitBtn.innerText = "Sign In";
                            toggleText.innerHTML = 'Don\'t have an account? <a href="#" id="toggle-auth-link">Create Account</a>';
                        }
                    });
                }

            } catch (error) { 
                console.error("Kayıt Hatası:", error);
                alert(`Kayıt başarısız: ${error.message}`); 
            }
        }

        else {
            try {
                // Mevcut kullanıcı girişi
                await signInWithEmailAndPassword(firebaseAuthenticationInstance, email, password);
                window.location.href = "dashboard.html";
            } catch (error) { 
                console.error("Giriş Hatası:", error);
                alert(`Giriş başarısız: ${error.message}`); 
            }
        }
    });
}

// Uygulamayı başlatıyoruz
startSecureApplication();