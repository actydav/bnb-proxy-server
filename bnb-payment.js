// === PAGOS CON BNB - INTEGRACIÓN OFICIAL ===
// Usa las credenciales reales y endpoints del PDF

const ACCOUNT_ID = 's9CG8FE7Id75ef2jeX9bUA==';
const AUTH_ID = '713K7PvTlACs1gdmv9jGgA==';

let bnbToken = null;
let bnbQrId = null;
let bnbCheckInterval = null;

// Obtener token JWT de BNB
async function obtenerTokenBNB() {
    if (bnbToken) return bnbToken;

    try {
        const response = await fetch('http://test.bnb.com.bo/ClientAuthentication.API/api/v1/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ACCOUNT_ID,
                password: AUTH_ID
            })
        });

        const data = await response.json();
        if (data.success && data.message) {
            bnbToken = data.message;
            console.log('Token BNB obtenido:', bnbToken.substring(0, 20) + '...');
            return bnbToken;
        } else {
            throw new Error(data.message || 'Fallo al obtener token');
        }
    } catch (error) {
        console.error('Error al obtener token BNB:', error);
        alert('Error de conexión con BNB: No se pudo obtener token');
        return null;
    }
}

// Generar QR con imagen
async function generarQRBNB(datosPago) {
    const token = await obtenerTokenBNB();
    if (!token) return null;

    try {
        const response = await fetch('http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRWithImageAsync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datosPago)
        });

        const data = await response.json();
        if (data.success && data.qr && data.id) {
            return { qr: data.qr, id: data.id };
        } else {
            throw new Error(data.message || 'Fallo al generar QR');
        }
    } catch (error) {
        console.error('Error al generar QR:', error);
        alert('Error al generar QR: ' + error.message);
        return null;
    }
}

// Consultar estado del QR
async function consultarEstadoQR(qrId) {
    const token = await obtenerTokenBNB();
    if (!token) return null;

    try {
        const response = await fetch('http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRStatusAsync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ qrId })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al consultar estado QR:', error);
        return null;
    }
}

// Cancelar QR
async function cancelarQR(qrId) {
    const token = await obtenerTokenBNB();
    if (!token || !qrId) return;

    try {
        await fetch('http://test.bnb.com.bo/QRSimple.API/api/v1/main/CancelQRByIdAsync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ qrId })
        });
    } catch (error) {
        console.error('Error al cancelar QR:', error);
    }
}

// Abrir modal de pago QR
async function abrirModalPagoBNB(ci) {
    const modal = document.getElementById('bnb-qr-modal');
    const canvas = document.getElementById('bnb-qr-canvas');
    const idSpan = document.getElementById('bnb-qr-id');
    const estadoSpan = document.getElementById('bnb-status');

    const estudiante = await firebaseServices.students.getStudentByCI(ci);
    if (!estudiante) {
        alert('Estudiante no encontrado');
        return;
    }

    const concepto = 'Mensualidad';
    const monto = 150;
    const glosa = `Pago ${concepto} - ${estudiante.lastNamePaternal} ${estudiante.lastNameMaternal} ${estudiante.firstName} (CI: ${ci})`;

    const datosPago = {
        currency: "BOB",
        gloss: glosa,
        amount: monto.toString(),
        singleUse: "true",
        expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString().split('T')[0]
    };

    const resultado = await generarQRBNB(datosPago);
    if (!resultado) return;

    // Mostrar QR
    const img = new Image();
    img.src = 'data:image/png;base64,' + resultado.qr;
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
    };

    bnbQrId = resultado.id;
    idSpan.textContent = bnbQrId;
    modal.classList.remove('hidden');
    estadoSpan.textContent = 'Esperando pago...';
    estadoSpan.className = 'text-sm text-gray-600 mt-2';

    // Verificar estado cada 5 segundos
    bnbCheckInterval = setInterval(async () => {
        const estado = await consultarEstadoQR(bnbQrId);
        if (!estado) return;

        // Ajusta según respuesta real del BNB (PDF no especifica campo exacto)
        if (estado.qrId === 2 || estado.status === 2) {
            estadoSpan.textContent = "¡PAGO CONFIRMADO!";
            estadoSpan.className = "text-sm font-bold text-green-600 mt-2";

            await firebaseServices.payments.addPayment(estudiante.id, concepto, {
                date: new Date().toISOString().split('T')[0],
                amount: monto,
                method: 'bnb'
            });

            await displayParentReport(ci);
            clearInterval(bnbCheckInterval);
            setTimeout(cerrarModalPagoBNB, 2000);
        } else if (estado.qrId === 3 || estado.status === 3) {
            estadoSpan.textContent = "QR expirado";
            estadoSpan.className = "text-sm font-bold text-red-600 mt-2";
            clearInterval(bnbCheckInterval);
        }
    }, 5000);
}

// Cerrar modal
function cerrarModalPagoBNB() {
    const modal = document.getElementById('bnb-qr-modal');
    modal.classList.add('hidden');

    if (bnbCheckInterval) clearInterval(bnbCheckInterval);
    if (bnbQrId) cancelarQR(bnbQrId);
    bnbQrId = null;
    bnbToken = null;
}

// Actualizar credenciales (opcional, para admin)
async function actualizarCredencialesBNB(nuevaAuthId) {
    if (!nuevaAuthId || nuevaAuthId.length < 15) {
        alert('La nueva autorización debe tener al menos 15 caracteres');
        return;
    }

    try {
        const response = await fetch('http://test.bnb.com.bo/ClientAuthentication.API/api/v1/auth/UpdateCredentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                AccountId: ACCOUNT_ID,
                actualAuthorizationId: AUTH_ID,
                newAuthorizationId: nuevaAuthId
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Credenciales actualizadas correctamente');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error al actualizar credenciales:', error);
        alert('Error al conectar con BNB');
    }
}