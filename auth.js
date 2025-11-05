// ===== autenticacion:p =====

async function login() {
    const ci = document.getElementById('ci').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('user-type').value;

    if (!ci || !password) {
        alert('Por favor complete todos los campos');
        return;
    }

    try {
        console.log('Intentando login con:', { ci, password, userType });
        
        const result = await firebaseServices.auth.loginUser(ci, password, userType);
        
        if (result.success) {
            console.log('Login exitoso:', result.user);
            // La redirección se maneja en onAuthStateChanged
        } else {
            console.error('Error en login:', result.error);
            alert('Error al iniciar sesión: ' + result.error);
        }
    } catch (error) {
        console.error('Error completo en login:', error);
        alert('Error de conexión: ' + error.message);
    }
}

// ===== enlazar hermanos =====

function toggleSiblingFields() {
    const hasSiblings = document.getElementById('has-siblings').value;
    const siblingFields = document.getElementById('sibling-fields');
    const verificationResult = document.getElementById('sibling-verification-result');
    
    if (hasSiblings === 'yes') {
        siblingFields.classList.remove('hidden');
    } else {
        siblingFields.classList.add('hidden');
        verificationResult.classList.add('hidden');
        verifiedSibling = null;
    }
}

async function verifySibling() {
    const siblingCi = document.getElementById('sibling-ci').value;
    const verificationResult = document.getElementById('sibling-verification-result');
    
    if (!siblingCi) {
        verificationResult.innerHTML = '<p class="text-red-600">Ingrese el CI del hermano</p>';
        verificationResult.classList.remove('hidden');
        return;
    }

    try {
        const sibling = await firebaseServices.students.getStudentByCI(siblingCi);
        
        if (!sibling) {
            verificationResult.innerHTML = '<p class="text-red-600">No se encontró estudiante con ese CI</p>';
            verificationResult.classList.remove('hidden');
            verifiedSibling = null;
            return;
        }

        if (sibling.familyGroup) {
            verificationResult.innerHTML = '<p class="text-orange-600">Este estudiante ya está enlazado con otro hermano</p>';
            verificationResult.classList.remove('hidden');
            verifiedSibling = null;
            return;
        }

        // verificar exitoso
        verifiedSibling = sibling;
        verificationResult.innerHTML = `
            <p class="text-green-600">Hermano verificado:</p>
            <p class="text-sm"><strong>Nombre:</strong> ${sibling.name}</p>
            <p class="text-sm"><strong>Grado:</strong> ${sibling.grade} ${sibling.parallel}</p>
        `;
        verificationResult.classList.remove('hidden');

    } catch (error) {
        console.error('Error verificando hermano:', error);
        verificationResult.innerHTML = '<p class="text-red-600">Error al verificar hermano</p>';
        verificationResult.classList.remove('hidden');
        verifiedSibling = null;
    }
}

async function register() {
    const firstName = document.getElementById('reg-first-name').value;
    const lastNamePaternal = document.getElementById('reg-last-name-paternal').value;
    const lastNameMaternal = document.getElementById('reg-last-name-maternal').value;
    const ci = document.getElementById('reg-ci').value;
    const password = document.getElementById('reg-password').value;
    const grade = document.getElementById('reg-grade').value;
    const parallel = document.getElementById('reg-parallel').value;
    const hasSiblings = document.getElementById('has-siblings').value;
    const paymentResponsibility = document.getElementById('payment-responsibility').value;

    // en regis, que todos los campos estén llenos
    if (!firstName || !lastNamePaternal || !lastNameMaternal || !ci || !password || !grade || !parallel) {
        alert('Complete todos los campos.');
        return;
    }

    // en regis, que la contraseña no esté vacía
    if (password.trim() === '') {
        alert('La contraseña no puede estar vacía.');
        return;
    }

    // en regis, validar hermano si se seleccionó esa opción
    if (hasSiblings === 'yes' && !verifiedSibling) {
        alert('Por favor, verifique el hermano antes de registrar.');
        return;
    }

    console.log('Intentando registrar estudiante:', { ci, password: '***', grade, parallel, hasSiblings: hasSiblings === 'yes' });

    try {
        const studentData = {
            firstName,
            lastNamePaternal,
            lastNameMaternal,
            name: `${lastNamePaternal} ${lastNameMaternal} ${firstName}`,
            ci,
            grade,
            parallel,
            payments: {},
            expenses: {},
            familyGroup: null,
            isPrimaryPayer: true
        };

        // enlace de hermanos
        if (hasSiblings === 'yes' && verifiedSibling) {
            const groupId = verifiedSibling.familyGroup || Date.now().toString();
            studentData.familyGroup = groupId;
            
            // quién es el pagador principal
            if (paymentResponsibility === 'me') {
                studentData.isPrimaryPayer = true;
                // actualizar el hermano existente para que no sea pagador principal
                verifiedSibling.isPrimaryPayer = false;
            } else {
                studentData.isPrimaryPayer = false;
                // hermano existente sigue siendo pagador principal
                verifiedSibling.isPrimaryPayer = true;
            }
            
            // actualizar el hermano existente con el groupId
            verifiedSibling.familyGroup = groupId;
        }

        // inicializar pagos para cada concepto
        concepts.forEach(c => {
            studentData.payments[c] = { payments: [], total: 0 };
        });

        const result = await firebaseServices.auth.registerUser(studentData, password);
        
        if (result.success) {
            // si hay hermano verificado, actualizarlo en la base de datos
            if (hasSiblings === 'yes' && verifiedSibling) {
                await firebaseServices.students.saveStudent(verifiedSibling);
                alert('¡Registro exitoso! Los estudiantes fueron enlazados como hermanos.');
            } else {
                alert('¡Registro exitoso! Ahora puede iniciar sesión.');
            }
            showLogin();
        } else {
            alert('Error en registro: ' + result.error);
        }
    } catch (error) {
        console.error('Error completo en registro:', error);
        alert('Error en registro: ' + error.message);
    }
}

async function logout() {
    await firebaseServices.auth.logout();
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('register-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('parent-panel').classList.add('hidden');
    closeAdminModal();
}

function showRegister() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('register-screen').classList.remove('hidden');
}

function showAdminPanel() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
}

function showParentPanel() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('parent-panel').classList.remove('hidden');
}

if (password.trim() === '' || password.length < 6) {
  alert('La contraseña debe tener al menos 6 caracteres.');
  return;
}

// In verifySibling() and register(): Add more logging/error handling if needed.

// In login(): Added
if (userType === 'admin' && ci !== 'admin_ci') { // Replace with actual admin CI if needed
  return { success: false, error: 'Acceso denegado' };
}