import Notification from '../models/Notification.js';

// @desc    Listar las notificaciones del usuario autenticado (más recientes primero)
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: { notifications }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener notificaciones'
    });
  }
};

// @desc    Cuántas notificaciones sin leer tiene el usuario autenticado
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el conteo de notificaciones'
    });
  }
};

// @desc    Marcar una notificación como leída
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    // user: req.user._id forzado en el filtro (no solo en el body) — nadie
    // puede marcar como leída una notificación ajena adivinando el id.
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al marcar la notificación como leída'
    });
  }
};

// @desc    Marcar todas las notificaciones del usuario autenticado como leídas
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      data: { updatedCount: result.modifiedCount || 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al marcar las notificaciones como leídas'
    });
  }
};
