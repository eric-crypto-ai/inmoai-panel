// ============================================
// InmoAI Panel - Configuración
// ============================================
// Cambia estas URLs por las de tus webhooks de n8n

const CONFIG = {
    // Webhook GET para leer leads desde Google Sheets
    WEBHOOK_GET_LEADS: 'https://primary-production-2cf7.up.railway.app/webhook/panel-leads',

    // Webhook POST para ejecutar acciones sobre un lead
    WEBHOOK_POST_ACTION: 'https://primary-production-2cf7.up.railway.app/webhook/panel-action',

    // Webhook GET para leer actividad de un lead
    WEBHOOK_GET_ACTIVIDAD: 'https://primary-production-2cf7.up.railway.app/webhook/panel-actividad',

    // Webhook GET para leer acciones disponibles desde config_acciones
    WEBHOOK_GET_CONFIG_ACCIONES: 'https://primary-production-2cf7.up.railway.app/webhook/panel-config-acciones',

    // Intervalo de auto-refresh en ms (0 = desactivado)
    AUTO_REFRESH_INTERVAL: 0,

    // Modo demo: usa datos ficticios sin llamar a webhooks
    DEMO_MODE: false,
};
