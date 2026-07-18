import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyCutK3vSR8vO1o7AXqZNcYCjORVe-b4_IE',
  authDomain: 'xelity-site.firebaseapp.com',
  databaseURL:
    'https://xelity-site-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'xelity-site',
  storageBucket: 'xelity-site.firebasestorage.app',
  messagingSenderId: '829385767520',
  appId: '1:829385767520:web:f208bde803107b768ee105',
  measurementId: 'G-6MNJ0EB3MJ',
};

// Web OAuth 2.0 Client ID (Google)
export const GOOGLE_WEB_CLIENT_ID =
  '829385767520-f1l5i292jpif743dabrgvdfli5pkt2jb.apps.googleusercontent.com';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
// Bind the provided Web client ID for Google sign-in
googleProvider.addScope('email');
googleProvider.addScope('profile');
