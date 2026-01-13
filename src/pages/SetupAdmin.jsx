import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const SetupAdmin = () => {
    const [status, setStatus] = useState('idle');

    const createAdmin = async () => {
        setStatus('processing');
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, 'admin@bodega.com', 'admin123');
            const user = userCredential.user;

            // 2. Create Firestore Profile
            await setDoc(doc(db, "users", user.uid), {
                email: 'admin@bodega.com',
                name: 'Administrador Principal',
                role: 'OWNER',
                assigned_bodega_id: 'bodega_1',
                createdAt: new Date()
            });

            setStatus('success');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                setStatus('exists');
            } else {
                setStatus('error: ' + error.message);
            }
        }
    };

    return (
        <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-slate-100">
            <h1 className="text-2xl font-bold mb-4">Setup Admin User</h1>
            <div className='mb-4 text-lg font-mono p-4 bg-white rounded shadow' id="status-display">
                Status: {status}
            </div>
            <button
                onClick={createAdmin}
                id="create-btn"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
            >
                Create Admin Account
            </button>
        </div>
    );
};

export default SetupAdmin;
