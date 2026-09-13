import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBJXyLOnEenJ4mnNOHh8HgRZfBWUHsyem0",
    authDomain: "MalkaERP.firebaseapp.com",
    projectId: "MalkaERP",
    storageBucket: "MalkaERP.firebasestorage.app",
    messagingSenderId: "545329052567",
    appId: "1:545329052567:web:f696d6fcb0e203b3ed62d2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);