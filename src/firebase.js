import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDL3ejtX5hhm5PPTDyQoTXSdZn-gH7_zeA",
  authDomain: "xioale-bodega-admin-2026.firebaseapp.com",
  projectId: "xioale-bodega-admin-2026",
  storageBucket: "xioale-bodega-admin-2026.firebasestorage.app",
  messagingSenderId: "119041372952",
  appId: "1:119041372952:web:1fd8031843e6d00be6646d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
