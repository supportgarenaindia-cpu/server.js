const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

// 1. Front-end Requests (CORS) Allow Karein
app.use(cors());
app.use(express.json());

// 2. Firebase Admin SDK Setup (Apni JSON Key se connect karein)
// Firebase Console -> Project Settings -> Service Accounts se key download karein
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 3. User Authentication Middleware (Token Check)
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or Expired token' });
    }
};

// 4. ENSURE-PROFILE ROUTE (Aapke App Ka Main Endpoint)
app.post('/ensure-profile', authenticateUser, async (req, res) => {
    try {
        const uid = req.user.uid;
        const email = req.user.email || '';
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            // Agar Naya User Hai -> Database Mein Default Profile Banayein
            const newUserData = {
                uid: uid,
                email: email,
                name: req.body.name || 'New User',
                walletBalance: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await userRef.set(newUserData);
            return res.status(200).json({ status: 'created', user: newUserData });
        } else {
            // Agar Purana User Hai -> Uska Profile Data Wapas Bhejein
            return res.status(200).json({ status: 'exists', user: doc.data() });
        }
    } catch (error) {
        console.error("Profile Setup Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Server Port Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

