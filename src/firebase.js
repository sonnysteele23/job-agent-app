import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyALlkv4IGswW0AfXlIQE9gS7ZW2Homli5o",
  authDomain: "jeepy-32e0e.firebaseapp.com",
  projectId: "jeepy-32e0e",
  storageBucket: "jeepy-32e0e.firebasestorage.app",
  messagingSenderId: "597994911188",
  appId: "1:597994911188:web:ad5e3f569434420e585241",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
