// ============================================
// InmoAI Panel - Configuración
// ============================================
// Cambia estas URLs por las de tus webhooks de n8n

const CONFIG = {
    // Webhook GET para leer leads desde Google Sheets
    WEBHOOK_GET_LEADS: 'https://TU-N8N-URL/webhook/leads',

    // Webhook POST para ejecutar acciones sobre un lead
    WEBHOOK_POST_ACTION: 'https://TU-N8N-URL/webhook/lead-action',

    // Intervalo de auto-refresh en ms (0 = desactivado)
    AUTO_REFRESH_INTERVAL: 0,

    // Modo demo: usa datos ficticios sin llamar a webhooks
    DEMO_MODE: true,
};
