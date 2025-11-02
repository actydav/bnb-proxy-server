// Archivo: server.js
// Proxy server para el API de Pagos del BNB.

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// node-fetch v2.x no tiene AbortController nativo, pero Render usa Node 18+
// que sí lo tiene globalmente. Si tienes problemas, instala 'abort-controller'.
const fetch = require('node-fetch'); 

const app = express();
const port = process.env.PORT || 3000; 

// ===============================================
// ⚠️ CREDENCIALES Y URLs DEL BNB (SEGUROS EN BACKEND)
// ===============================================

// Credenciales de prueba
const BNB_ACCOUNT_ID = 's9CG8FE7Id75ef2jeX9bUA=='; 
const BNB_AUTHORIZATION_ID = '713K7PvTlACs1gdmv9jGgA=='; 

// URLs del API de prueba. Cambiadas a HTTPS para mejor compatibilidad con Render.
const BNB_AUTH_URL = 'http://test.bnb.com.bo/ClientAuthentication.API/api/v1/auth/token';
const BNB_QR_GEN_URL = 'http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRWithImageAsync';
const BNB_QR_STATUS_URL = 'http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRStatusAsync';


// ===============================================
// MIDDLEWARE
// ===============================================
app.use(cors()); 
app.use(bodyParser.json());


// ===============================================
// FUNCIÓN INTERNA: Obtener Token (CON MANEJO DE TIMEOUT)
// ===============================================
async function getBnbAuthToken() {
    // Definimos un controlador y un tiempo de espera de 15 segundos para la API externa
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort(); 
    }, 15000); // 15 segundos de tiempo de espera

    try {
        const response = await fetch(BNB_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal, // Vincula el timeout a la petición
            body: JSON.stringify({
                accountId: BNB_ACCOUNT_ID,
                authorizationid: BNB_AUTHORIZATION_ID
            })
        });

        clearTimeout(timeout); // Si la respuesta llega, limpiamos el timer

        if (!response.ok) {
            // Maneja 400, 401, 500 del BNB
            throw new Error(`BNB Auth falló con estado ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.message) {
            return data.message;
        } else {
            console.error('Error al obtener Token BNB:', data);
            throw new Error('Error de autenticación. Respuesta BNB inválida.');
        }
    } catch (error) {
        clearTimeout(timeout);
        
        // Error específico cuando el controlador aborta la petición (Timeout)
        if (error.name === 'AbortError') { 
            console.error('La petición al BNB expiró después de 15 segundos.');
            // Devolvemos el mensaje genérico que tu frontend detecta
            throw new Error('Fallo en la comunicación con la API de autenticación del BNB.'); 
        }

        console.error('Fallo de conexión en getBnbAuthToken:', error);
        // Devolvemos el mensaje genérico para otros errores de red/conexión
        throw new Error('Fallo en la comunicación con la API de autenticación del BNB.'); 
    }
}


// ===============================================
// ENDPOINT 1: POST /api/bnb/generate-qr
// ===============================================
app.post('/api/bnb/generate-qr', async (req, res) => {
    // Si la función getBnbAuthToken falla, el try/catch lo atrapará y devolverá 500
    try {
        const payload = req.body;
        
        // 1. Obtener Token
        const token = await getBnbAuthToken(); 

        // 2. Llamar a la API de Generación de QR del BNB
        const bnbResponse = await fetch(BNB_QR_GEN_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        const bnbData = await bnbResponse.json();
        
        // 3. Devolver la respuesta del BNB
        if (bnbData.success && bnbData.qr) {
            return res.status(200).send({ success: true, qr: bnbData.qr, id: bnbData.id });
        } else {
            return res.status(400).send({
                success: false,
                // Usamos el mensaje del BNB si está disponible
                message: bnbData.message || 'Error desconocido del BNB al generar QR.'
            });
        }
    } catch (error) {
        // Captura el mensaje de error de getBnbAuthToken()
        console.error('Error en generate-qr endpoint:', error.message);
        return res.status(500).send({ success: false, message: error.message });
    }
});


// ===============================================
// ENDPOINT 2: POST /api/bnb/check-status
// ===============================================
app.post('/api/bnb/check-status', async (req, res) => {
    try {
        const { qrId } = req.body;
        if (!qrId) {
            return res.status(400).send({ success: false, message: 'Falta el qrId.' });
        }
        
        const token = await getBnbAuthToken(); 

        // Llamar a la API de Estado de QR del BNB
        const bnbResponse = await fetch(BNB_QR_STATUS_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ qrId: qrId })
        });

        const bnbData = await bnbResponse.json();
        
        // Devolver la respuesta al Front-end
        return res.status(200).send({
            success: true,
            statusId: bnbData.statusId,
            message: bnbData.message 
        });

    } catch (error) {
        console.error('Error en check-status endpoint:', error.message);
        return res.status(500).send({ success: false, message: error.message });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`BNB Proxy Server escuchando en http://localhost:${port}`);
});

