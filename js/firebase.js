// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAYCjJecVLJ5hHGS-fDExfsRZBOrCFHy3Y",
  authDomain:        "dentalpro-cff23.firebaseapp.com",
  projectId:         "dentalpro-cff23",
  storageBucket:     "dentalpro-cff23.firebasestorage.app",
  messagingSenderId: "715635002127",
  appId:             "1:715635002127:web:287ed8f3324fedd255cc7a",
  measurementId:     "G-7J2NDQKK0C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
