// ============================================
// InmoAI Panel - Aplicación principal
// ============================================

const app = {
    leads: [],
    filteredLeads: [],
    selectedLead: null,

    // -------------------------------------------
    // Inicialización
    // -------------------------------------------
    init() {
        this.loadLeads();
        if (CONFIG.AUTO_REFRESH_INTERVAL > 0) {
            setInterval(() => this.loadLeads(), CONFIG.AUTO_REFRESH_INTERVAL);
        }
    },

    // -------------------------------------------
    // Cargar leads desde webhook o datos demo
    // -------------------------------------------
    async loadLeads() {
        const statusEl = document.getElementById('connection-status');

        if (CONFIG.DEMO_MODE) {
            this.leads = this.getDemoData();
            statusEl.textContent = 'Modo demo';
            statusEl.className = 'text-sm text-amber-500 font-medium';
            this.filterLeads();
            this.updateStats();
            return;
        }

        try {
            statusEl.textContent = 'Cargando...';
            statusEl.className = 'text-sm text-gray-400';

            const response = await fetch(CONFIG.WEBHOOK_GET_LEADS);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            this.leads = await response.json();
            statusEl.textContent = `Conectado · ${this.leads.length} leads`;
            statusEl.className = 'text-sm text-green-600 font-medium';
        } catch (error) {
            statusEl.textContent = 'Error de conexión';
            statusEl.className = 'text-sm text-red-500 font-medium';
            console.error('Error cargando leads:', error);
        }

        this.filterLeads();
        this.updateStats();
    },

    // -------------------------------------------
    // Filtros
    // -------------------------------------------
    filterLeads() {
        const search = document.getElementById('filter-search').value.toLowerCase();
        const estado = document.getElementById('filter-estado').value;
        const prioridad = document.getElementById('filter-prioridad').value;

        this.filteredLeads = this.leads.filter(lead => {
            const matchSearch = !search ||
                (lead.nombre || '').toLowerCase().includes(search) ||
                (lead.apellidos || '').toLowerCase().includes(search) ||
                (lead.email || '').toLowerCase().includes(search) ||
                (lead.telefono || '').includes(search);
            const matchEstado = !estado || lead.estado_lead === estado;
            const matchPrioridad = !prioridad || lead.prioridad === prioridad;
            return matchSearch && matchEstado && matchPrioridad;
        });

        this.renderTable();
    },

    // -------------------------------------------
    // Estadísticas
    // -------------------------------------------
    updateStats() {
        document.getElementById('stat-total').textContent = this.leads.length;
        document.getElementById('stat-nuevos').textContent =
            this.leads.filter(l => l.estado_lead === 'Nuevo').length;
        document.getElementById('stat-seguimiento').textContent =
            this.leads.filter(l => l.estado_lead === 'Seguimiento' || l.estado_lead === 'Contactado').length;
        document.getElementById('stat-visitas').textContent =
            this.leads.filter(l => l.estado_lead === 'Visita agendada').length;
    },

    // -------------------------------------------
    // Renderizar tabla
    // -------------------------------------------
    renderTable() {
        const tbody = document.getElementById('leads-table-body');

        if (this.filteredLeads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-4 py-12 text-center text-gray-400">
                        No se encontraron leads
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = this.filteredLeads.map(lead => `
            <tr class="hover:bg-gray-50 cursor-pointer transition" onclick="app.openModal('${lead.lead_id}')">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${lead.nombre || ''} ${lead.apellidos || ''}</div>
                    <div class="text-xs text-gray-400">${lead.lead_id || ''}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-gray-700">${lead.email || '-'}</div>
                    <div class="text-sm text-gray-500">${lead.telefono || '-'}</div>
                </td>
                <td class="px-4 py-3">
                    <span class="text-sm text-gray-700">${lead.operacion || '-'}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium ${this.getEstadoClass(lead.estado_lead)}">
                        ${lead.estado_lead || '-'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium ${this.getPrioridadClass(lead.prioridad)}">
                        ${lead.prioridad || '-'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-gray-700">${lead.proxima_accion || '-'}</div>
                    <div class="text-xs text-gray-400">${lead.fecha_proxima_accion || ''}</div>
                </td>
                <td class="px-4 py-3">
                    <button onclick="event.stopPropagation(); app.openModal('${lead.lead_id}')" class="text-primary hover:text-secondary text-sm font-medium">
                        Abrir
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // -------------------------------------------
    // Modal - Ficha de lead
    // -------------------------------------------
    openModal(leadId) {
        const lead = this.leads.find(l => l.lead_id === leadId);
        if (!lead) return;

        this.selectedLead = lead;
        document.getElementById('modal-title').textContent =
            `${lead.nombre || ''} ${lead.apellidos || ''}`;

        const fields = [
            { label: 'Lead ID', value: lead.lead_id },
            { label: 'Email', value: lead.email },
            { label: 'Teléfono', value: lead.telefono },
            { label: 'Municipio', value: lead.municipio },
            { label: 'Zona de interés', value: lead.zona_interes },
            { label: 'Operación', value: lead.operacion },
            { label: 'Tipo inmueble', value: lead.tipo_inmueble },
            { label: 'Presupuesto', value: lead.presupuesto ? `${lead.presupuesto} €` : null },
            { label: 'Estado', value: lead.estado_lead },
            { label: 'Prioridad', value: lead.prioridad },
            { label: 'Lead Score', value: lead.lead_score },
            { label: 'Agente', value: lead.agente_asignado },
            { label: 'Seguimiento', value: lead.seguimiento },
            { label: 'Próxima acción', value: lead.proxima_accion },
            { label: 'Fecha próxima acción', value: lead.fecha_proxima_accion },
            { label: 'Último contacto', value: lead.ultimo_contacto },
            { label: 'Origen', value: lead.origen },
            { label: 'Canal preferido', value: lead.canal_preferido },
            { label: 'Interés real', value: lead.interes_real },
            { label: 'Urgencia', value: lead.urgencia },
        ];

        const mensaje = lead.mensaje || '';
        const observaciones = lead.observaciones_ia || '';
        const notas = lead.notas || '';

        document.getElementById('modal-body').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                ${fields.filter(f => f.value).map(f => `
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${f.label}</p>
                        <p class="text-sm font-medium text-gray-900">${f.value}</p>
                    </div>
                `).join('')}
            </div>
            ${mensaje ? `
                <div class="mb-4">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Mensaje del lead</p>
                    <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">${mensaje}</p>
                </div>
            ` : ''}
            ${observaciones ? `
                <div class="mb-4">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Observaciones IA</p>
                    <p class="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">${observaciones}</p>
                </div>
            ` : ''}
            ${notas ? `
                <div class="mb-4">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Notas</p>
                    <p class="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">${notas}</p>
                </div>
            ` : ''}
        `;

        // Reset estado dropdown
        const estadoSelect = document.getElementById('action-estado');
        if (estadoSelect) estadoSelect.selectedIndex = 0;

        document.getElementById('lead-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('lead-modal').classList.add('hidden');
        this.selectedLead = null;
    },

    // -------------------------------------------
    // Acciones sobre un lead
    // -------------------------------------------
    async action(type) {
        if (!this.selectedLead) return;

        // Recoger params según tipo de acción
        let params = {};

        if (type === 'estado') {
            // Estado se maneja desde actionEstado()
            return;
        }

        if (type === 'agente') {
            const agente = prompt('Nombre del agente a asignar:');
            if (!agente) return;
            params.agente = agente;
        }

        if (type === 'visita') {
            const fecha = prompt('Fecha de la visita (YYYY-MM-DD):');
            if (!fecha) return;
            const hora = prompt('Hora de la visita (HH:MM):', '10:00');
            if (!hora) return;
            params.fecha_visita = fecha;
            params.hora_visita = hora;
        }

        if (type === 'whatsapp') {
            const mensaje = prompt(
                'Mensaje personalizado (dejar vacío para mensaje automático):',
                ''
            );
            if (mensaje !== null && mensaje !== '') {
                params.mensaje_custom = mensaje;
            }
        }

        this._sendAction(type, params);
    },

    // -------------------------------------------
    // Acción: cambiar estado desde dropdown
    // -------------------------------------------
    actionEstado(selectEl) {
        const nuevoEstado = selectEl.value;
        if (!nuevoEstado || !this.selectedLead) {
            selectEl.selectedIndex = 0;
            return;
        }
        // Reset select for next use
        selectEl.selectedIndex = 0;
        // Execute the action with params
        this._sendAction('estado', { nuevo_estado: nuevoEstado });
    },

    // -------------------------------------------
    // Enviar acción al webhook
    // -------------------------------------------
    async _sendAction(type, params) {
        if (!this.selectedLead) return;

        if (CONFIG.DEMO_MODE) {
            alert(`[DEMO] Acción "${type}" sobre lead ${this.selectedLead.lead_id}\nParams: ${JSON.stringify(params)}`);
            return;
        }

        try {
            const response = await fetch(CONFIG.WEBHOOK_POST_ACTION, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: type,
                    lead_id: this.selectedLead.lead_id,
                    lead: this.selectedLead,
                    params: params,
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            alert(result.message || `Acción "${type}" ejecutada correctamente`);
            this.closeModal();
            this.loadLeads();
        } catch (error) {
            alert(`Error ejecutando acción: ${error.message}`);
            console.error('Error en acción:', error);
        }
    },

    // -------------------------------------------
    // Estilos dinámicos
    // -------------------------------------------
    getEstadoClass(estado) {
        const classes = {
            'Nuevo': 'bg-blue-100 text-blue-700',
            'Contactado': 'bg-cyan-100 text-cyan-700',
            'Seguimiento': 'bg-amber-100 text-amber-700',
            'Visita agendada': 'bg-green-100 text-green-700',
            'Cerrado Ganado': 'bg-emerald-100 text-emerald-800',
            'Cerrado Perdido': 'bg-red-100 text-red-700',
            'Descartado': 'bg-gray-100 text-gray-500',
        };
        return classes[estado] || 'bg-gray-100 text-gray-600';
    },

    getPrioridadClass(prioridad) {
        const classes = {
            'Alta': 'bg-red-100 text-red-700',
            'Media-Alta': 'bg-orange-100 text-orange-700',
            'Media': 'bg-yellow-100 text-yellow-700',
            'Baja': 'bg-gray-100 text-gray-500',
        };
        return classes[prioridad] || 'bg-gray-100 text-gray-600';
    },

    // -------------------------------------------
    // Datos demo
    // -------------------------------------------
    getDemoData() {
        return [
            {
                lead_id: 'L-001',
                nombre: 'María',
                apellidos: 'García López',
                email: 'maria.garcia@email.com',
                telefono: '+34 612 345 678',
                municipio: 'Gavà',
                zona_interes: 'Centre',
                operacion: 'Compra',
                tipo_inmueble: 'Piso',
                presupuesto: '250000',
                estado_lead: 'Nuevo',
                prioridad: 'Alta',
                lead_score: 80,
                agente_asignado: 'Sin Asignar',
                seguimiento: 'Pendiente de revisar',
                proxima_accion: 'Llamar',
                fecha_proxima_accion: '2026-04-09',
                ultimo_contacto: '',
                origen: 'Web',
                canal_preferido: 'WhatsApp',
                interes_real: 'Por revisar',
                urgencia: 'Por revisar',
                mensaje: 'Busco piso de 3 habitaciones cerca del centro de Gavà, preferiblemente con parking.',
                observaciones_ia: '',
                notas: '',
            },
            {
                lead_id: 'L-002',
                nombre: 'Carlos',
                apellidos: 'Martínez Ruiz',
                email: 'carlos.m@email.com',
                telefono: '+34 698 765 432',
                municipio: 'Castelldefels',
                zona_interes: 'Playa',
                operacion: 'Compra',
                tipo_inmueble: 'Casa',
                presupuesto: '450000',
                estado_lead: 'Contactado',
                prioridad: 'Alta',
                lead_score: 90,
                agente_asignado: 'Ana Pérez',
                seguimiento: 'En contacto',
                proxima_accion: 'Agendar visita',
                fecha_proxima_accion: '2026-04-10',
                ultimo_contacto: '2026-04-07',
                origen: 'Idealista',
                canal_preferido: 'Teléfono',
                interes_real: 'Alto',
                urgencia: 'Media',
                mensaje: 'Interesado en chalet cerca de la playa. Presupuesto flexible si la zona es buena.',
                observaciones_ia: 'Lead de alto valor. Presupuesto elevado y zona premium.',
                notas: 'Llamar por la tarde, trabaja por las mañanas.',
            },
            {
                lead_id: 'L-003',
                nombre: 'Laura',
                apellidos: 'Fernández',
                email: 'laura.f@email.com',
                telefono: '',
                municipio: 'Viladecans',
                zona_interes: '',
                operacion: 'Alquiler',
                tipo_inmueble: 'Piso',
                presupuesto: '900',
                estado_lead: 'Nuevo',
                prioridad: 'Baja',
                lead_score: 30,
                agente_asignado: 'Sin Asignar',
                seguimiento: 'Pendiente de revisar',
                proxima_accion: 'Enviar email',
                fecha_proxima_accion: '2026-04-09',
                ultimo_contacto: '',
                origen: 'Web',
                canal_preferido: 'Email',
                interes_real: 'Por revisar',
                urgencia: 'Por revisar',
                mensaje: 'Busco alquiler económico en Viladecans.',
                observaciones_ia: '',
                notas: '',
            },
            {
                lead_id: 'L-004',
                nombre: 'Pedro',
                apellidos: 'Sánchez Mora',
                email: 'pedro.sanchez@email.com',
                telefono: '+34 655 123 789',
                municipio: 'Gavà',
                zona_interes: 'Les Bòbiles',
                operacion: 'Venta',
                tipo_inmueble: 'Piso',
                presupuesto: '180000',
                estado_lead: 'Visita agendada',
                prioridad: 'Media-Alta',
                lead_score: 70,
                agente_asignado: 'Ana Pérez',
                seguimiento: 'Visita programada',
                proxima_accion: 'Realizar visita',
                fecha_proxima_accion: '2026-04-11',
                ultimo_contacto: '2026-04-06',
                origen: 'Referido',
                canal_preferido: 'WhatsApp',
                interes_real: 'Alto',
                urgencia: 'Alta',
                mensaje: 'Quiero vender mi piso en Les Bòbiles. Necesito valoración.',
                observaciones_ia: 'Urgente: quiere vender rápido por cambio de ciudad.',
                notas: 'Visita agendada jueves 11 a las 17:00',
            },
            {
                lead_id: 'L-005',
                nombre: 'Ana',
                apellidos: 'López Torres',
                email: 'ana.lopez@email.com',
                telefono: '+34 677 888 999',
                municipio: 'Sant Boi',
                zona_interes: 'Centro',
                operacion: 'Compra',
                tipo_inmueble: 'Piso',
                presupuesto: '200000',
                estado_lead: 'Seguimiento',
                prioridad: 'Media',
                lead_score: 60,
                agente_asignado: 'Sin Asignar',
                seguimiento: 'Esperando respuesta',
                proxima_accion: 'Escribir WhatsApp',
                fecha_proxima_accion: '2026-04-09',
                ultimo_contacto: '2026-04-05',
                origen: 'Web',
                canal_preferido: 'WhatsApp',
                interes_real: 'Medio',
                urgencia: 'Baja',
                mensaje: '',
                observaciones_ia: '',
                notas: 'Se le enviaron 3 opciones de pisos, no ha contestado.',
            },
        ];
    },
};

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') app.closeModal();
});

// Cerrar modal clickando fuera
document.getElementById('lead-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) app.closeModal();
});

// Iniciar la app
app.init();
