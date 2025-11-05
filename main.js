// ===== iniciar =====
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        // cargar configuración
        const config = await firebaseServices.config.getConfig();
        concepts = config.concepts || ['Mensualidad'];
        expenses = config.expenses || [];
        
        // escuchar cambios de autenticación
        firebaseServices.auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userData = await firebaseServices.auth.getUserData(user.uid);
                currentUser = userData;
                
                if (userData.type === 'admin') {
                    showAdminPanel();
                } else {
                    showParentPanel();
                    await displayParentReport(userData.ci);
                }
            } else {
                showLogin();
            }
        });
        
    } catch (error) {
        console.error('Error inicializando app:', error);
    }
}

function setupEventListeners() {
    const toggleMenuButton = document.querySelector('.toggle-menu');
    const menuLateral = document.querySelector('.menu-lateral');

    toggleMenuButton.addEventListener('click', () => {
        menuLateral.classList.toggle('show');
        toggleMenuButton.classList.toggle('open');
    });
}