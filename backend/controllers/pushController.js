import { isPushConfigured, saveSubscription, removeSubscription, countSubscriptions } from '../services/pushService.js';
import { getVapidConfig } from '../utils/pushConfig.js';

const b64url = /^[A-Za-z0-9_-]+$/;

// Una suscripción válida: endpoint https y las dos claves en base64url
export function validSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return false;
  const { endpoint, keys } = subscription;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !/^https:\/\/[^\s]+$/.test(endpoint)) return false;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return false;
  return b64url.test(keys.p256dh) && keys.p256dh.length <= 256 && b64url.test(keys.auth) && keys.auth.length <= 256;
}

const NOT_CONFIGURED = {
  success: false,
  code: 'PUSH_NOT_CONFIGURED',
  message: 'Las notificaciones del dispositivo todavía no están disponibles en el servidor.'
};

// @desc    Estado de las notificaciones push para el usuario autenticado
// @route   GET /api/push/status
// @access  Private
export const getPushStatus = async (req, res) => {
  try {
    const configured = isPushConfigured();
    res.status(200).json({
      success: true,
      data: {
        configured,
        // La clave pública es, por diseño, pública: el navegador la necesita para suscribirse
        publicKey: configured ? getVapidConfig().publicKey : null,
        subscribedDevices: configured ? await countSubscriptions(req.user._id) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al consultar las notificaciones' });
  }
};

// @desc    Registrar este dispositivo para recibir notificaciones push
// @route   POST /api/push/subscribe
// @access  Private
export const subscribe = async (req, res) => {
  try {
    if (!isPushConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const { subscription } = req.body;
    if (!validSubscription(subscription)) {
      return res.status(400).json({ success: false, message: 'La suscripción del dispositivo no es válida' });
    }

    await saveSubscription(req.user._id, subscription, req.get?.('user-agent'));
    res.status(201).json({ success: true, data: { subscribedDevices: await countSubscriptions(req.user._id) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al activar las notificaciones' });
  }
};

// @desc    Quitar este dispositivo de las notificaciones push
// @route   POST /api/push/unsubscribe
// @access  Private
export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (typeof endpoint !== 'string' || !/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 2048) {
      return res.status(400).json({ success: false, message: 'Dispositivo no válido' });
    }

    // Solo se borra la suscripción de ESTE usuario: nadie puede dar de baja el dispositivo de otro
    await removeSubscription(req.user._id, endpoint);
    res.status(200).json({ success: true, data: { subscribedDevices: await countSubscriptions(req.user._id) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al desactivar las notificaciones' });
  }
};
