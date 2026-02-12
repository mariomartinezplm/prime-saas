
import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api';

const runTest = async () => {
    try {
        // 1. Get a random active patient
        await mongoose.connect(process.env.MONGODB_URI);
        const patient = await User.findOne({ role: 'patient', isActive: true });

        if (!patient) {
            console.log('❌ No active patient found');
            return;
        }
        console.log(`👤 Using patient: ${patient.email} (Active: ${patient.isActive})`);

        // Reset password to known value if needed to login?? 
        // We can't login without password. 
        // Let's assume we can use the '123456' default if they were migrated

        // Login
        console.log('🔄 Logging in...');
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: patient.email,
                password: '123456' // Default from migration
            });
            const token = loginRes.data.data.token;
            console.log('✅ Login successful');

            // Find a professional
            const proRes = await axios.get(`${API_URL}/users?role=professional`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const prof = proRes.data.data.users[0];
            console.log(`👨‍⚕️ Professional: ${prof.firstName}`);

            // Try to book
            console.log('🔄 Attempting booking (should succeed if Logic is correct)...');
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 2);
            const dateStr = nextWeek.toISOString().split('T')[0];

            const bookingRes = await axios.post(`${API_URL}/appointments`, {
                professional: prof.id,
                date: dateStr,
                startTime: '10:00',
                endTime: '11:00',
                type: 'entrenamiento'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('✅ Booking result:', bookingRes.data.message);

            // Clean up
            console.log('Cleaning up appointment...');
            await axios.delete(`${API_URL}/appointments/${bookingRes.data.data.appointment._id}/cancel`, {
                headers: { Authorization: `Bearer ${token}` }
            });

        } catch (err) {
            if (err.response?.status === 401) {
                console.log('⚠️ Login failed (password changed?). Skipping this user.');
            } else {
                console.error('❌ Error:', err.response?.data?.message || err.message);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

runTest();
