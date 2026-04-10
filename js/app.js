// ============================================
// InmoAI Panel - Aplicación principal
// ============================================

const app = {
    leads: [],
    filteredLeads: [],
    acciones: [],
    configOpciones: null, // {prioridades, proximas_acciones, canales}
    pendingAccionId: null, // acción seleccionada pendiente de ejecutar
    selectedLead: null,
    filteringVencidos: false,
    sortField: null,
    sortDir: 1, // 1 = asc, -1 = desc

    // -------------------------------------------
    // Inicialización
    // -------------------------------------------
    init() {
        this.loadLeads();
        this.loadConfigAcciones();
        this.loadConfigOpciones();
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
    // Cargar acciones disponibles desde config_acciones
    // -------------------------------------------
    async loadConfigAcciones() {
        if (CONFIG.DEMO_MODE) {
            this.acciones = [
                { accion_id: 'marcar_caliente', nombre_accion: 'Marcar como caliente', requiere_confirmacion: false, necesita_fecha: false },
                { accion_id: 'contactado', nombre_accion: 'Marcar como contactado', requiere_confirmacion: false, necesita_fecha: false },
                { accion_id: 'agendar_visita', nombre_accion: 'Agendar visita', requiere_confirmacion: false, necesita_fecha: true },
                { accion_id: 'descartar_lead', nombre_accion: 'Descartar lead', requiere_confirmacion: true, necesita_fecha: false },
            ];
            this.populateAccionesDropdown();
            return;
        }
        try {
            const res = await fetch(CONFIG.WEBHOOK_GET_CONFIG_ACCIONES);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.acciones = await res.json();
            this.populateAccionesDropdown();
        } catch (err) {
            console.error('Error cargando config_acciones:', err);
        }
    },

    populateAccionesDropdown() {
        const select = document.getElementById('action-accion');
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Ejecutar acción...</option>';
        this.acciones.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.accion_id;
            opt.textContent = a.nombre_accion;
            select.appendChild(opt);
        });
    },

    // -------------------------------------------
    // Carga de opciones validadas desde hoja config
    // -------------------------------------------
    async loadConfigOpciones() {
        if (CONFIG.DEMO_MODE || !CONFIG.WEBHOOK_GET_CONFIG_OPCIONES) return;
        try {
            const res = await fetch(CONFIG.WEBHOOK_GET_CONFIG_OPCIONES);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.json();
            this.configOpciones = Array.isArray(raw) ? raw[0] : raw;
        } catch (err) {
            console.error('Error cargando config opciones:', err);
        }
    },

    // -------------------------------------------
    // Acción seleccionada: muestra panel de personalización
    // -------------------------------------------
    onAccionSelected(selectEl) {
        const accionId = selectEl.value;
        if (!accionId || !this.selectedLead) {
            selectEl.selectedIndex = 0;
            return;
        }

        const config = this.acciones.find(a => a.accion_id === accionId);
        if (!config) return;

        this.pendingAccionId = accionId;

        // Mostrar panel de personalización
        const panel = document.getElementById('customize-panel');
        const nombre = document.getElementById('customize-accion-nombre');
        if (panel) panel.classList.remove('hidden');
        if (nombre) nombre.textContent = config.nombre_accion;

        // Reset toggle y campos
        const toggle = document.getElementById('customize-toggle');
        if (toggle) toggle.checked = false;
        const fields = document.getElementById('customize-fields');
        if (fields) fields.classList.add('hidden');

        // Poblar dropdowns con datos validados de config
        this._populateCustomizeDropdowns();
    },

    _populateCustomizeDropdowns() {
        const opts = this.configOpciones || {};

        const prioSelect = document.getElementById('customize-prioridad');
        if (prioSelect) {
            prioSelect.innerHTML = (opts.prioridades || ['Alta', 'Media-Alta', 'Media', 'Baja'])
                .map(p => `<option value="${p}">${p}</option>`).join('');
        }

        const proxSelect = document.getElementById('customize-proxima');
        if (proxSelect) {
            proxSelect.innerHTML = (opts.proximas_acciones || ['Llamar', 'Hacer seguimiento', 'Ninguna'])
                .map(p => `<option value="${p}">${p}</option>`).join('');
        }

        const canalSelect = document.getElementById('customize-canal');
        if (canalSelect) {
            canalSelect.innerHTML = (opts.canales || ['WhatsApp', 'Llamada', 'Email', 'Indiferente'])
                .map(c => `<option value="${c}">${c}</option>`).join('');
        }

        // Reset checkboxes y fecha
        const calCb = document.getElementById('customize-calendar');
        const notCb = document.getElementById('customize-notificar');
        const recCb = document.getElementById('customize-recordatorio');
        if (calCb) calCb.checked = false;
        if (notCb) notCb.checked = false;
        if (recCb) recCb.checked = false;
        const fechaInput = document.getElementById('customize-fecha');
        const horaInput = document.getElementById('customize-hora');
        if (fechaInput) fechaInput.value = '';
        if (horaInput) horaInput.value = '09:00';
    },

    toggleCustomize() {
        const fields = document.getElementById('customize-fields');
        const toggle = document.getElementById('customize-toggle');
        if (fields && toggle) {
            fields.classList.toggle('hidden', !toggle.checked);
        }
    },

    executeCustomAction() {
        const accionId = this.pendingAccionId;
        if (!accionId || !this.selectedLead) return;

        const config = this.acciones.find(a => a.accion_id === accionId);
        if (!config) return;

        if (config.requiere_confirmacion) {
            if (!confirm(`¿Confirmar acción "${config.nombre_accion}" sobre este lead?`)) return;
        }

        let params = {};

        // Fecha de visita para agendar_visita (siempre necesaria)
        if (config.necesita_fecha || accionId === 'agendar_visita') {
            const fecha = document.getElementById('customize-fecha')?.value;
            const hora = document.getElementById('customize-hora')?.value || '10:00';
            if (!fecha) {
                alert('Selecciona una fecha para la visita');
                return;
            }
            params.fecha_visita = fecha;
            params.hora_visita = hora;
        }

        // Si personalización activada, añadir overrides
        const toggle = document.getElementById('customize-toggle');
        if (toggle && toggle.checked) {
            const overrides = {};

            const prioridad = document.getElementById('customize-prioridad')?.value;
            if (prioridad) overrides.prioridad = prioridad;

            const proxima = document.getElementById('customize-proxima')?.value;
            if (proxima) overrides.proxima_accion = proxima;

            const fecha = document.getElementById('customize-fecha')?.value;
            const hora = document.getElementById('customize-hora')?.value || '09:00';
            if (fecha) overrides.fecha_proxima_accion = fecha + ' ' + hora;

            const canal = document.getElementById('customize-canal')?.value;
            if (canal) overrides.canal_sugerido = canal;

            overrides.crear_evento_calendar = document.getElementById('customize-calendar')?.checked || false;
            overrides.notificar_agente = document.getElementById('customize-notificar')?.checked || false;
            overrides.generar_recordatorio = document.getElementById('customize-recordatorio')?.checked || false;

            params.overrides = overrides;
        }

        this._sendAction(accionId, params);
        this.cancelCustomAction();
    },

    cancelCustomAction() {
        this.pendingAccionId = null;
        const panel = document.getElementById('customize-panel');
        if (panel) panel.classList.add('hidden');
        const select = document.getElementById('action-accion');
        if (select) select.selectedIndex = 0;
    },

    // -------------------------------------------
    // Utilidades
    // -------------------------------------------
    isVencido(lead) {
        if (!lead.fecha_proxima_accion) return false;
        const estado = lead.estado_lead || '';
        if (estado === 'Cerrado Ganado' || estado === 'Cerrado Perdido' || estado === 'Descartado') return false;
        const fechaStr = lead.fecha_proxima_accion.split(' ')[0];
        const hoy = new Date().toISOString().split('T')[0];
        return fechaStr < hoy;
    },

    // -------------------------------------------
    // Filtros
    // -------------------------------------------
    filterLeads() {
        const search = document.getElementById('filter-search').value.toLowerCase();
        const estado = document.getElementById('filter-estado').value;
        const prioridad = document.getElementById('filter-prioridad').value;
        const agente = document.getElementById('filter-agente').value;

        this.filteredLeads = this.leads.filter(lead => {
            const matchSearch = !search ||
                (lead.nombre || '').toLowerCase().includes(search) ||
                (lead.apellidos || '').toLowerCase().includes(search) ||
                (lead.email || '').toLowerCase().includes(search) ||
                (lead.telefono || '').includes(search);
            const matchEstado = !estado || lead.estado_lead === estado;
            const matchPrioridad = !prioridad || lead.prioridad === prioridad;
            const matchAgente = !agente || lead.agente_asignado === agente;
            const matchVencidos = !this.filteringVencidos || this.isVencido(lead);
            return matchSearch && matchEstado && matchPrioridad && matchAgente && matchVencidos;
        });

        if (this.sortField) {
            const prioridadOrder = { 'Alta': 1, 'Media-Alta': 2, 'Media': 3, 'Baja': 4 };
            const dir = this.sortDir;
            const field = this.sortField;

            this.filteredLeads.sort((a, b) => {
                let va = a[field] || '';
                let vb = b[field] || '';

                if (field === 'lead_score') {
                    return (Number(va) - Number(vb)) * dir;
                }
                if (field === 'prioridad') {
                    return ((prioridadOrder[va] || 99) - (prioridadOrder[vb] || 99)) * dir;
                }
                if (field === 'fecha_proxima_accion') {
                    va = va.split(' ')[0] || '9999';
                    vb = vb.split(' ')[0] || '9999';
                }
                return va.localeCompare(vb) * dir;
            });
        }

        this.renderTable();
    },

    sortBy(field) {
        if (this.sortField === field) {
            this.sortDir *= -1;
        } else {
            this.sortField = field;
            this.sortDir = 1;
        }
        this.updateSortIndicators();
        this.filterLeads();
    },

    updateSortIndicators() {
        const sortable = ['nombre', 'operacion', 'estado_lead', 'prioridad', 'fecha_proxima_accion', 'lead_score'];
        sortable.forEach(f => {
            const el = document.getElementById('sort-' + f);
            if (el) el.textContent = this.sortField === f ? (this.sortDir === 1 ? '\u25B2' : '\u25BC') : '';
        });
    },

    toggleFilterVencidos() {
        this.filteringVencidos = !this.filteringVencidos;
        const card = document.getElementById('stat-vencidos-card');
        if (this.filteringVencidos) {
            card.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
        } else {
            card.classList.remove('ring-2', 'ring-red-500', 'bg-red-50');
        }
        this.filterLeads();
    },

    // -------------------------------------------
    // Estadísticas
    // -------------------------------------------
    updateStats() {
        document.getElementById('stat-total').textContent = this.leads.length;
        document.getElementById('stat-nuevos').textContent =
            this.leads.filter(l => l.estado_lead === 'Nuevo').length;
        document.getElementById('stat-seguimiento').textContent =
            this.leads.filter(l => ['Contactado', 'Caliente', 'Templado', 'Frío', 'Seguimiento', 'Información enviada', 'Oferta enviada'].includes(l.estado_lead)).length;
        document.getElementById('stat-visitas').textContent =
            this.leads.filter(l => l.estado_lead === 'Visita agendada').length;
        const vencidos = this.leads.filter(l => this.isVencido(l)).length;
        document.getElementById('stat-vencidos').textContent = vencidos;
        const card = document.getElementById('stat-vencidos-card');
        if (vencidos > 0) {
            card.classList.add('border-red-300', 'bg-red-50');
            card.classList.remove('border-gray-100', 'bg-white');
        } else {
            card.classList.remove('border-red-300', 'bg-red-50');
            card.classList.add('border-gray-100', 'bg-white');
        }
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
            <tr class="${this.isVencido(lead) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} cursor-pointer transition" onclick="app.openModal('${lead.lead_id}')">
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
                    <div class="text-sm ${this.isVencido(lead) ? 'text-red-600 font-semibold' : 'text-gray-700'}">${lead.proxima_accion || '-'}</div>
                    <div class="text-xs ${this.isVencido(lead) ? 'text-red-500' : 'text-gray-400'}">${this.isVencido(lead) ? 'VENCIDA - ' : ''}${lead.fecha_proxima_accion || ''}</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="text-sm font-semibold text-gray-700">${lead.lead_score || '-'}</span>
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
            <div class="mb-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Notas</p>
                <div class="flex gap-2">
                    <textarea id="action-notas" rows="2" class="flex-1 text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Añadir nota...">${notas}</textarea>
                    <button onclick="app.actionNotas()" class="self-end bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition whitespace-nowrap">Guardar</button>
                </div>
            </div>
            <div id="lead-actividad" class="mb-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Historial de actividad</p>
                <div class="text-sm text-gray-400 italic">Cargando actividad...</div>
            </div>
            <div id="lead-docs" class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Documentaci\u00f3n</p>
                    <button onclick="app.toggleUploadForm()" class="text-xs text-primary hover:text-secondary font-medium">+ Subir documento</button>
                </div>
                <div id="upload-form" class="hidden mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div class="flex flex-wrap gap-2 mb-2 items-center">
                        <select id="doc-category" onchange="app.updateDocTypes()" class="border border-gray-300 rounded px-2 py-1 text-sm">
                            <option value="Identificaci\u00f3n">Identificaci\u00f3n</option>
                            <option value="Inmueble">Inmueble</option>
                            <option value="Financiero">Financiero</option>
                            <option value="Contratos">Contratos</option>
                            <option value="Proceso">Proceso</option>
                            <option value="General">General</option>
                        </select>
                        <select id="doc-type" class="border border-gray-300 rounded px-2 py-1 text-sm"></select>
                        <input type="file" id="doc-file" class="text-sm max-w-[200px]" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx">
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.uploadDoc()" id="btn-upload" class="bg-primary text-white px-3 py-1 rounded text-sm font-medium hover:bg-secondary">Subir</button>
                        <button onclick="app.toggleUploadForm()" class="text-gray-500 px-3 py-1 rounded text-sm hover:text-gray-700">Cancelar</button>
                    </div>
                </div>
                <div id="docs-list" class="text-sm text-gray-400 italic">Cargando documentos...</div>
            </div>
        `;

        // Reset action controls
        const accionSelect = document.getElementById('action-accion');
        if (accionSelect) accionSelect.selectedIndex = 0;
        const agenteSelect = document.getElementById('action-agente');
        if (agenteSelect) agenteSelect.selectedIndex = 0;
        this.cancelCustomAction();

        document.getElementById('lead-modal').classList.remove('hidden');

        this.loadActividad(lead.lead_id);
        this.loadDocs(lead.lead_id);
    },

    async loadActividad(leadId) {
        const container = document.getElementById('lead-actividad');
        if (!container || CONFIG.DEMO_MODE) return;

        try {
            const res = await fetch(`${CONFIG.WEBHOOK_GET_ACTIVIDAD}?lead_id=${encodeURIComponent(leadId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const events = await res.json();

            if (!events.length) {
                container.innerHTML = `
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Historial de actividad</p>
                    <p class="text-sm text-gray-400 italic">Sin actividad registrada</p>`;
                return;
            }

            container.innerHTML = `
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Historial de actividad (${events.length})</p>
                <div class="max-h-48 overflow-y-auto space-y-1">
                    ${events.map(e => {
                        const desc = this.formatEvento(e);
                        const tiempo = this.timeAgo(e.fecha_hora);
                        const icon = this.eventoIcon(e.tipo_evento);
                        const statusColor = e.estado === 'ERROR' ? 'text-red-500' : 'text-gray-500';
                        return `<div class="flex items-start gap-2 text-sm border-l-2 ${e.estado === 'ERROR' ? 'border-red-300' : 'border-blue-200'} pl-2 py-1">
                            <span class="shrink-0">${icon}</span>
                            <div class="min-w-0">
                                <span class="font-medium text-gray-700">${desc}</span>
                                <span class="${statusColor} text-xs ml-1">${tiempo}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
        } catch (err) {
            container.innerHTML = `
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Historial de actividad</p>
                <p class="text-sm text-red-400 italic">Error cargando actividad</p>`;
        }
    },

    formatEvento(e) {
        const tipo = e.tipo_evento || '';
        switch (tipo) {
            case 'cambio_estado':
                return `Estado: ${e.valor_anterior || '?'} → ${e.valor_nuevo || '?'}`;
            case 'visita_agendada':
                return `Visita agendada`;
            case 'asignacion_agente':
                return `Agente: ${e.valor_nuevo || '?'}`;
            case 'whatsapp_enviado':
                return `WhatsApp enviado`;
            case 'email_enviado':
                return `Email enviado`;
            case 'actualizacion_notas':
                return `Notas actualizadas`;
            case 'accion_ejecutada':
                return e.detalle || `Acción: ${e.valor_nuevo || '?'}`;
            case 'lead_creado':
                return `Lead creado`;
            case 'deduplicacion_email':
                return `Deduplicado por email`;
            case 'deduplicacion_telefono':
                return `Deduplicado por teléfono`;
            default:
                return e.detalle || tipo || 'Evento';
        }
    },

    eventoIcon(tipo) {
        const icons = {
            'cambio_estado': '\u{1F504}',
            'visita_agendada': '\u{1F4C5}',
            'asignacion_agente': '\u{1F464}',
            'whatsapp_enviado': '\u{1F4AC}',
            'email_enviado': '\u{2709}',
            'actualizacion_notas': '\u{1F4DD}',
            'lead_creado': '\u{2728}',
            'whatsapp_error': '\u{26A0}',
            'email_error': '\u{26A0}',
            'error_visita_sin_fecha': '\u{26A0}',
            'error_calendar': '\u{26A0}',
            'accion_ejecutada': '\u{26A1}',
        };
        return icons[tipo] || '\u{25CF}';
    },

    timeAgo(fechaStr) {
        if (!fechaStr) return '';
        const fecha = new Date(fechaStr.replace(' ', 'T'));
        const now = new Date();
        const diffMs = now - fecha;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'ahora';
        if (mins < 60) return `hace ${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `hace ${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `hace ${days}d`;
        return fechaStr.split(' ')[0];
    },

    closeModal() {
        document.getElementById('lead-modal').classList.add('hidden');
        this.selectedLead = null;
        this.cancelCustomAction();
    },

    // -------------------------------------------
    // Acciones sobre un lead
    // -------------------------------------------
    async action(type) {
        if (!this.selectedLead) return;
        let params = {};
        if (type === 'whatsapp') {
            const mensaje = prompt('Mensaje personalizado (dejar vacío para mensaje automático):', '');
            if (mensaje !== null && mensaje !== '') {
                params.mensaje_custom = mensaje;
            }
        }
        this._sendAction(type, params);
    },

    // (actionEstado eliminado — reemplazado por onAccionSelected)

    // -------------------------------------------
    // Acción: guardar notas
    // -------------------------------------------
    actionNotas() {
        const textarea = document.getElementById('action-notas');
        if (!textarea || !this.selectedLead) return;
        const notas = textarea.value.trim();
        this._sendAction('notas', { notas: notas });
    },

    // (actionVisita eliminado — integrado en onAccionSelected con agendar_visita)

    // -------------------------------------------
    // Acción: asignar agente desde dropdown
    // -------------------------------------------
    actionAgente(selectEl) {
        const agente = selectEl.value;
        if (!agente || !this.selectedLead) {
            selectEl.selectedIndex = 0;
            return;
        }
        selectEl.selectedIndex = 0;
        this._sendAction('agente', { agente: agente });
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
    // Documentación — Upload y listado
    // -------------------------------------------
    DOC_TYPES: {
        'Identificación': ['DNI/NIE', 'Pasaporte', 'Otro'],
        'Inmueble': ['Escrituras', 'Nota simple', 'Certificado energético', 'Cédula habitabilidad', 'IBI', 'Certificado comunidad', 'Planos', 'Fotos', 'Otro'],
        'Financiero': ['Justificante ingresos', 'Pre-aprobación hipotecaria', 'Otro'],
        'Contratos': ['Contrato mandato', 'Ficha visita', 'Propuesta/contraoferta', 'Contrato arras', 'Contrato compraventa', 'Contrato alquiler', 'Factura honorarios', 'Otro'],
        'Proceso': ['Ficha visita firmada', 'Otro'],
        'General': ['Otro']
    },

    toggleUploadForm() {
        const form = document.getElementById('upload-form');
        if (!form) return;
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) {
            this.updateDocTypes();
        }
    },

    updateDocTypes() {
        const category = document.getElementById('doc-category')?.value || 'General';
        const docTypeSelect = document.getElementById('doc-type');
        if (!docTypeSelect) return;
        const options = this.DOC_TYPES[category] || ['Otro'];
        docTypeSelect.innerHTML = options.map(t => `<option value="${t}">${t}</option>`).join('');
    },

    async uploadDoc() {
        const fileInput = document.getElementById('doc-file');
        const category = document.getElementById('doc-category')?.value || 'General';
        const docType = document.getElementById('doc-type')?.value || '';
        const btn = document.getElementById('btn-upload');

        if (!fileInput || !fileInput.files.length) {
            alert('Selecciona un archivo');
            return;
        }
        if (!this.selectedLead) return;

        const file = fileInput.files[0];
        if (file.size > 10 * 1024 * 1024) {
            alert('El archivo no puede superar los 10 MB');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Subiendo...'; }

        try {
            const base64 = await this.fileToBase64(file);
            const response = await fetch(CONFIG.WEBHOOK_UPLOAD_DOC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: this.selectedLead.lead_id,
                    lead_name: ((this.selectedLead.nombre || '') + ' ' + (this.selectedLead.apellidos || '')).trim(),
                    category: category,
                    doc_type: docType,
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    fileData: base64
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const raw = await response.json();
            const result = Array.isArray(raw) ? raw[0] : raw;
            alert(result.success ? 'Documento subido correctamente' : 'Error al subir documento');
            this.toggleUploadForm();
            fileInput.value = '';
            this.loadDocs(this.selectedLead.lead_id);
        } catch (error) {
            alert('Error subiendo documento: ' + error.message);
            console.error('Error upload doc:', error);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Subir'; }
        }
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async loadDocs(leadId) {
        const container = document.getElementById('docs-list');
        if (!container || CONFIG.DEMO_MODE) {
            if (container) container.innerHTML = '<p class="text-sm text-gray-400 italic">Sin documentos (modo demo)</p>';
            return;
        }

        try {
            const res = await fetch(`${CONFIG.WEBHOOK_LIST_DOCS}?lead_id=${encodeURIComponent(leadId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.json();
            const data = Array.isArray(raw) ? raw[0] : raw;
            const docs = data.docs || [];

            if (!docs.length) {
                container.innerHTML = '<p class="text-sm text-gray-400 italic">Sin documentos</p>';
                return;
            }

            const grouped = {};
            docs.forEach(d => {
                const cat = d.category || 'General';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(d);
            });

            let html = '<div class="space-y-2">';
            for (const [cat, catDocs] of Object.entries(grouped)) {
                html += `<div>
                    <p class="text-xs font-semibold text-gray-600 mb-1">${cat}</p>
                    <div class="ml-2 space-y-1">`;
                catDocs.forEach(d => {
                    const icon = this.docIcon(d.mimeType);
                    const date = d.date ? new Date(d.date).toLocaleDateString('es-ES') : '';
                    const label = d.doc_type ? d.doc_type + ' — ' + d.name : d.name;
                    html += `<div class="flex items-center gap-2">
                        <span class="shrink-0">${icon}</span>
                        <a href="${d.url}" target="_blank" rel="noopener" class="text-sm text-primary hover:text-secondary hover:underline truncate">${label}</a>
                        <span class="text-xs text-gray-400 shrink-0">${date}</span>
                    </div>`;
                });
                html += '</div></div>';
            }
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p class="text-sm text-red-400 italic">Error cargando documentos</p>';
            console.error('Error loadDocs:', err);
        }
    },

    docIcon(mimeType) {
        if (!mimeType) return '\u{1F4C4}';
        if (mimeType.includes('pdf')) return '\u{1F4D5}';
        if (mimeType.includes('image')) return '\u{1F5BC}';
        if (mimeType.includes('word') || mimeType.includes('document')) return '\u{1F4DD}';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return '\u{1F4CA}';
        return '\u{1F4C4}';
    },

    // -------------------------------------------
    // Estilos dinámicos
    // -------------------------------------------
    getEstadoClass(estado) {
        const classes = {
            'Nuevo': 'bg-blue-100 text-blue-700',
            'Contactado': 'bg-cyan-100 text-cyan-700',
            'Caliente': 'bg-red-100 text-red-700',
            'Templado': 'bg-orange-100 text-orange-700',
            'Frío': 'bg-sky-100 text-sky-700',
            'Seguimiento': 'bg-amber-100 text-amber-700',
            'Información enviada': 'bg-violet-100 text-violet-700',
            'Visita agendada': 'bg-green-100 text-green-700',
            'Visitado': 'bg-teal-100 text-teal-700',
            'Oferta enviada': 'bg-indigo-100 text-indigo-700',
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
