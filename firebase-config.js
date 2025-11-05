// ===== config. firebase =====
const firebaseConfig = {
    apiKey: "AIzaSyAw7DYTj7bZUO2A7meg0WkfoLsMp5ndCjw",
    authDomain: "gestion-fya-ue-candida.firebaseapp.com",
    projectId: "gestion-fya-ue-candida",
    storageBucket: "gestion-fya-ue-candida.firebasestorage.app",
    messagingSenderId: "842332234295",
    appId: "1:842332234295:web:5946b2049900ea9b2415b2"
};

// iniciar firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ===== variables =====
let students = [];
let concepts = ['Mensualidad'];
let expenses = [];
let currentUser = null;
let adminChart = null;
let parentChart = null;
const monthlyFee = 150;

// variables para enlace de hermanos en regist.
let verifiedSibling = null;