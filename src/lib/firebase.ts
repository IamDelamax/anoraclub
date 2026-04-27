import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAyVhze6H7qMSSV-9FHA4I2FYkaBbYTAzc",
  authDomain: "anoraclub.firebaseapp.com",
  projectId: "anoraclub",
  storageBucket: "anoraclub.firebasestorage.app",
  messagingSenderId: "578072447430",
  appId: "1:578072447430:web:9ce0461ffbd63641d90ac7",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
