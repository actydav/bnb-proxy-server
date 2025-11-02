// Archivo: server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000; // Usa el puerto 3000 si no se especifica uno por el hosting

// ===============================================
// ⚠️ CREDENCIALES BNB (MANTENER OCULTAS)
// ===============================================
// Estas credenciales solo existen en el servidor (backend)

const BNB_ACCOUNT_ID = 's9CG8FE7Id75ef2jeX9bUA=='; 
const BNB_AUTHORIZATION_ID = '713K7PvTlACs1gdmv9jGgA=='; 

const BNB_AUTH_URL = 'https://test.bnb.com.bo/ClientAuthentication.API/api/v1/auth/token';
const BNB_QR_GEN_URL = 'https://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRWithImageAsync';
const BNB_QR_STATUS_URL = 'https://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRStatusAsync';


// ===============================================
// MIDDLEWARE: Configuración del servidor
// ===============================================

// Habilita CORS para permitir que tu frontend hable con este servidor.
// ⚠️ En producción, reemplaza '*' con el dominio de tu frontend: 
// Ejemplo: { origin: 'https://gestion-fya-ue-candida.web.app' }
app.use(cors()); 

// Permite analizar cuerpos de solicitud JSON
app.use(bodyParser.json());


// ===============================================
// FUNCIÓN INTERNA: Obtener Token
// ===============================================
async function getBnbAuthToken() {
    try {
        const response = await fetch(BNB_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId: BNB_ACCOUNT_ID,
                authorizationid: BNB_AUTHORIZATION_ID
            })
        });

        if (!response.ok) {
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
        console.error('Fallo de conexión en getBnbAuthToken:', error);
        throw new Error('Fallo en la comunicación con la API de autenticación del BNB.');
    }
}


// ===============================================
// ENDPOINT 1: POST /api/bnb/generate-qr
// ===============================================
app.post('/api/bnb/generate-qr', async (req, res) => {
    try {
        const payload = req.body;
        
        // 1. Obtener Token de forma segura
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
        
        // 3. Devolver la respuesta del BNB al Front-end
        if (bnbData.success && bnbData.qr) {
            return res.status(200).send({ success: true, qr: bnbData.qr, id: bnbData.id });
        } else {
            return res.status(400).send({
                success: false,
                message: bnbData.message || 'Error del BNB al generar QR.'
            });
        }
    } catch (error) {
        console.error('Error en generate-qr endpoint:', error.message);
        return res.status(500).send({ success: false, message: error.message || 'Error interno del servidor.' });
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
        
        // 1. Obtener Token de forma segura
        const token = await getBnbAuthToken(); 

        // 2. Llamar a la API de Estado de QR del BNB
        const bnbResponse = await fetch(BNB_QR_STATUS_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ qrId: qrId })
        });

        const bnbData = await bnbResponse.json();
        
        // 3. Devolver la respuesta simplificada al Front-end
        return res.status(200).send({
            success: true,
            statusId: bnbData.statusId,
            message: bnbData.message 
        });

    } catch (error) {
        console.error('Error en check-status endpoint:', error.message);
        return res.status(500).send({ success: false, message: error.message || 'Error interno del servidor.' });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`BNB Proxy Server escuchando en http://localhost:${port}`);

});
