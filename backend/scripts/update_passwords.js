
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const updatePasswords = async () => {
    console.log('🔄 Iniciando actualización de contraseñas...');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        const users = await User.find({});
        console.log(`📊 Encontrados ${users.length} usuarios.`);

        let updatedCount = 0;

        for (const user of users) {
            let newPassword = '';

            if (user.role === 'admin' || user.role === 'professional') {
                newPassword = 'Primefh2026@';
            } else if (user.role === 'patient') {
                newPassword = '123456';
            } else {
                // En caso de que haya otros roles, por defecto usar el de paciente o mantener
                newPassword = '123456';
            }

            // Asignar la nueva contraseña directamente
            user.password = newPassword;

            // Guardar para que el pre-save hook de Mongoose la hashee
            await user.save();

            updatedCount++;
            console.log(`   ✅ Usuario ${user.email} (${user.role}) actualizado.`);
        }

        console.log(`\n🎉 Proceso finalizado. ${updatedCount} usuarios actualizados.`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

updatePasswords();
