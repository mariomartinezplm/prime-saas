
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Adjust path to .env file relative to this script location (backend/scripts/check_user.js)
const envPath = join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

async function check() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('URI configured:', mongoUri ? 'YES' : 'NO');

        if (!mongoUri) throw new Error('MONGODB_URI missing');

        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected to MongoDB');

        const email = 'mariomartinezplm@gmail.com';
        const u = await User.findOne({ email }).select('+password');

        console.log(`Checking user: ${email}`);
        if (u) {
            console.log('✅ User Found');
            console.log('Role:', u.role);
            console.log('Active:', u.isActive);
            // Verify password hash manually if needed
            const isMatch = await u.comparePassword('Prime2026@');
            console.log('Password "Prime2026@" Match:', isMatch ? 'YES' : 'NO');
        } else {
            console.log('❌ User Not Found');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

check();
