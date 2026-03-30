
        // =====================================================
        //  ESTADO GLOBAL
        // =====================================================
        let playersData = [];
        let tournamentStages = [];
        let currentPicker = { active: false, playerIndex: null, type: null };
        let activeMatchId = null;
        let pollingInterval = null;
        let lastMatchSnapshot = {};

        // Custom round names (Lobby & Round Robin): key = roundId (or index), value = custom string
        let customRoundNames = {};

        // =====================================================
        //  BROADCAST CHANNEL
        // =====================================================
        const fgcChannel = new BroadcastChannel('fgc_channel');

        fgcChannel.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'REPORT_MATCH') {
                handleReportMatch(payload);
            }
        };

        // =====================================================
        //  RECURSOS
        // =====================================================
        const RESOURCES = {
            flags: [
                { code: 'do', name: 'Republica Dominicana' }, { code: 'pe', name: 'Peru' },
                { code: 've', name: 'Venezuela' }, { code: 'cl', name: 'Chile' },
                { code: 'us', name: 'USA' }, { code: 'jp', name: 'Japon' },
                { code: 'mx', name: 'Mexico' }, { code: 'br', name: 'Brasil' },
                { code: 'pr', name: 'Puerto Rico' }, { code: 'kr', name: 'Corea' },
                { code: 'cn', name: 'China' }, { code: 'fr', name: 'Francia' },
                { code: 'es', name: 'España' }, { code: 'ca', name: 'Canada' },
                { code: 'gb', name: 'Reino Unido' }, { code: 'uk', name: 'Reino Unido UK' },
                { code: 'ar', name: 'Argentina' }, { code: 'bo', name: 'Bolivia' },
                { code: 'co', name: 'Colombia' }, { code: 'cr', name: 'Costa Rica' },
                { code: 'cu', name: 'Cuba' }, { code: 'ec', name: 'Ecuador' },
                { code: 'gt', name: 'Guatemala' }, { code: 'hn', name: 'Honduras' },
                { code: 'ni', name: 'Nicaragua' }, { code: 'pa', name: 'Panama' },
                { code: 'py', name: 'Paraguay' }, { code: 'sv', name: 'El Salvador' },
                { code: 'uy', name: 'Uruguay' }, { code: 'jm', name: 'Jamaica' },
                { code: 'ht', name: 'Haiti' }, { code: 'tt', name: 'Trinidad y Tobago' },
                { code: 'bb', name: 'Barbados' }, { code: 'bs', name: 'Bahamas' },
                { code: 'de', name: 'Alemania' }, { code: 'it', name: 'Italia' },
                { code: 'pt', name: 'Portugal' }, { code: 'ru', name: 'Rusia' },
                { code: 'nl', name: 'Paises Bajos' }, { code: 'be', name: 'Belgica' },
                { code: 'ch', name: 'Suiza' }, { code: 'se', name: 'Suecia' },
                { code: 'no', name: 'Noruega' }, { code: 'dk', name: 'Dinamarca' },
                { code: 'fi', name: 'Finlandia' }, { code: 'pl', name: 'Polonia' },
                { code: 'at', name: 'Austria' }, { code: 'gr', name: 'Grecia' },
                { code: 'ie', name: 'Irlanda' }, { code: 'cz', name: 'Rep Checa' },
                { code: 'ua', name: 'Ucrania' }, { code: 'gb-eng', name: 'Inglaterra' },
                { code: 'gb-sct', name: 'Escocia' }, { code: 'gb-wls', name: 'Gales' },
                { code: 'au', name: 'Australia' }, { code: 'nz', name: 'Nueva Zelanda' },
                { code: 'in', name: 'India' }, { code: 'id', name: 'Indonesia' },
                { code: 'ph', name: 'Filipinas' }, { code: 'th', name: 'Tailandia' },
                { code: 'vn', name: 'Vietnam' }, { code: 'my', name: 'Malasia' },
                { code: 'sg', name: 'Singapur' }, { code: 'pk', name: 'Pakistan' },
                { code: 'tw', name: 'Taiwan' }, { code: 'hk', name: 'Hong Kong' },
                { code: 'sa', name: 'Arabia Saudita' }, { code: 'ae', name: 'Emiratos Arabes' },
                { code: 'tr', name: 'Turquia' }, { code: 'il', name: 'Israel' },
                { code: 'za', name: 'Sudafrica' }, { code: 'eg', name: 'Egipto' },
                { code: 'ma', name: 'Marruecos' }, { code: 'ng', name: 'Nigeria' },
                { code: 'gh', name: 'Ghana' }, { code: 'cm', name: 'Camerun' },
                { code: 'sn', name: 'Senegal' }, { code: 'ci', name: 'Costa de Marfil' }
            ],
            shields: [],
            socials: []
        };

        let pickerAllItems = [];

        // =====================================================
        //  TOURNAMENT FORMAT DETECTION
        // =====================================================
        /**
         * Returns a normalized format string from stage data:
         * 'double_elimination' | 'single_elimination' | 'round_robin' | 'lobby'
         */
        function detectFormat(stage) {
            const raw = (stage.type || stage.format || stage.bracket_type || '').toLowerCase();
            if (raw.includes('double')) return 'double_elimination';
            if (raw.includes('single')) return 'single_elimination';
            if (raw.includes('robin')) return 'round_robin';
            if (raw.includes('lobby') || raw.includes('exhibition')) return 'lobby';
            // Fallback: if pools have rounds but no losers field, treat as single
            // If stage has is_double_elimination flag
            if (stage.is_double_elimination) return 'double_elimination';
            // If no matches have loser side, single elim is a safe guess over double
            return 'single_elimination';
        }

        // =====================================================
        //  TABS
        // =====================================================
        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`).classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        }

        function handleEnter(event) {
            if (event.key === 'Enter') connectAPI();
        }

        // =====================================================
        //  PERSISTENCIA
        // =====================================================
        function saveData() {
            if (playersData.length > 0) {
                const state = {
                    token: document.getElementById('api-token').value,
                    tourneyId: document.getElementById('tournament-id').value,
                    tourneyName: document.getElementById('tournament-name-label').innerText,
                    players: playersData,
                    stages: tournamentStages,
                    customRoundNames
                };
                localStorage.setItem('fgc_advanced_state', JSON.stringify(state));
            }
        }

        function loadSavedData() {
            const saved = localStorage.getItem('fgc_advanced_state');
            if (saved) {
                try {
                    const state = JSON.parse(saved);
                    document.getElementById('api-token').value = state.token;
                    document.getElementById('tournament-id').value = state.tourneyId;
                    playersData = (state.players || []).map(p => migrateSocials(p));
                    tournamentStages = state.stages || [];
                    customRoundNames = state.customRoundNames || state.lobbyRoundNames || {};

                    document.getElementById('btn-connect').style.display = 'none';
                    document.getElementById('btn-connected').style.display = 'block';
                    document.getElementById('tournament-name-label').innerText = state.tourneyName;

                    renderTable();
                    renderBracket();
                    startPolling();
                } catch (e) {
                    console.error("Error cargando guardado:", e);
                    localStorage.removeItem('fgc_advanced_state');
                }
            }
        }

        // =====================================================
        //  API & CONEXIÓN
        // =====================================================
        async function connectAPI() {
            const token = document.getElementById('api-token').value.trim();
            const tourneyCode = document.getElementById('tournament-id').value.trim();
            const btnConnect = document.getElementById('btn-connect');

            if (!token || !tourneyCode) return alert("Faltan datos de conexión.");

            btnConnect.innerText = "Cargando...";
            btnConnect.disabled = true;

            try {
                const data = await fetchTournament(token, tourneyCode);

                btnConnect.style.display = 'none';
                btnConnect.disabled = false;
                document.getElementById('btn-connected').style.display = 'block';
                document.getElementById('tournament-name-label').innerText = `OK: ${data.name.toUpperCase()}`;

                if (data.players) processPlayers(data.players);
                tournamentStages = data.stages || [];

                renderBracket();
                saveData();
                startPolling();
                showToast(`Conectado a "${data.name}"`, 'success');

            } catch (e) {
                btnConnect.innerText = "Conectar";
                btnConnect.disabled = false;
                showToast("Error de conexión: Verifica el token y el ID", 'error');
                console.error(e);
            }
        }

        async function fetchTournament(token, tourneyCode) {
            const response = await fetch(`https://round.one/api/tournaments/${tourneyCode}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }

        function disconnectAPI() {
            if (confirm("¿Estás seguro de cerrar el torneo? Se perderán las configuraciones actuales.")) {
                stopPolling();
                setSyncIndicator('off');

                document.getElementById('btn-connected').style.display = 'none';
                const btnConnect = document.getElementById('btn-connect');
                btnConnect.style.display = 'block';
                btnConnect.innerText = 'Conectar';

                document.getElementById('players-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">Torneo desconectado.</td></tr>`;
                document.getElementById('bracket-render').innerHTML = `El árbol del torneo aparecerá aquí tras conectar.`;
                document.getElementById('bracket-hint').style.display = 'none';

                playersData = [];
                tournamentStages = [];
                activeMatchId = null;
                lastMatchSnapshot = {};
                customRoundNames = {};
                localStorage.removeItem('fgc_advanced_state');
            }
        }

        // =====================================================
        //  POLLING EN TIEMPO REAL
        // =====================================================
        function startPolling() {
            stopPolling();
            setSyncIndicator('live');
            pollingInterval = setInterval(pollTournament, 3000);
        }

        function stopPolling() {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }

        async function pollTournament() {
            const token = document.getElementById('api-token').value.trim();
            const tourneyCode = document.getElementById('tournament-id').value.trim();
            if (!token || !tourneyCode) return;

            try {
                const data = await fetchTournament(token, tourneyCode);
                const newStages = data.stages || [];

                let hasChanges = false;
                const newSnapshot = {};

                newStages.forEach(stage => {
                    (stage.pools || []).forEach(pool => {
                        (pool.rounds || []).forEach(round => {
                            (round.matches || []).forEach(match => {
                                const key = match.id;
                                const val = `${match.player1_score}-${match.player2_score}-${match.winner}`;
                                newSnapshot[key] = val;
                                if (lastMatchSnapshot[key] !== val) hasChanges = true;
                            });
                        });
                    });
                });

                if (hasChanges) {
                    tournamentStages = newStages;
                    lastMatchSnapshot = newSnapshot;
                    renderBracket();
                    if (data.players) processPlayers(data.players);
                    saveData();
                    showToast('Bracket actualizado', 'info');
                }

                lastMatchSnapshot = newSnapshot;
                setSyncIndicator('live');

            } catch (e) {
                setSyncIndicator('error');
                console.error("Error en polling:", e);
            }
        }

        function setSyncIndicator(state) {
            const el = document.getElementById('sync-indicator');
            const txt = document.getElementById('sync-text');
            el.className = '';
            if (state === 'off') {
                el.style.display = 'none';
            } else if (state === 'live') {
                el.style.display = 'flex';
                el.classList.add('live');
                const now = new Date();
                txt.innerText = `EN VIVO · ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            } else if (state === 'error') {
                el.style.display = 'flex';
                el.classList.add('error');
                txt.innerText = 'SIN CONEXIÓN';
            }
        }

        // =====================================================
        //  REPORT MATCH
        // =====================================================
        async function handleReportMatch(payload) {
            const token = document.getElementById('api-token').value.trim();
            if (!token) {
                showToast('No hay token API para reportar', 'error');
                return;
            }
            if (!payload.match_id) {
                showToast('No hay partida activa seleccionada en el bracket', 'error');
                return;
            }

            try {
                showToast('Reportando resultado a Round.One...', 'info');
                const response = await fetch('https://round.one/api/matches/report', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        match_id: payload.match_id,
                        player1_score: payload.player1_score,
                        player2_score: payload.player2_score,
                        winner: payload.winner
                    })
                });

                if (!response.ok) {
                    const err = await response.text();
                    throw new Error(err);
                }

                showToast('✅ Resultado reportado correctamente', 'success');
                setTimeout(pollTournament, 1500);

            } catch (e) {
                showToast(`Error al reportar: ${e.message}`, 'error');
                console.error(e);
            }
        }

        // =====================================================
        //  PARTICIPANTES
        // =====================================================
        function processPlayers(apiPlayers) {
            const newPlayers = apiPlayers.map(p => {
                const existing = playersData.find(ep => ep.id === p.id);
                if (existing) return migrateSocials(existing);
                return {
                    id: p.id, apiName: p.name, alias: p.name,
                    flag: 'do', shield: '',
                    socials: [{ type: '', handle: '' }]
                };
            });
            playersData = newPlayers;
            renderTable();
        }

        // Migrar formato viejo (socialType/socialHandle) al nuevo array socials
        function migrateSocials(p) {
            if (!p.socials) {
                p.socials = [{ type: p.socialType || '', handle: p.socialHandle || '' }];
                delete p.socialType;
                delete p.socialHandle;
            }
            return p;
        }

        function renderTable() {
            const tbody = document.getElementById('players-tbody');
            tbody.innerHTML = '';

            if (playersData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">No hay jugadores cargados.</td></tr>`;
                return;
            }

            // Find active players to highlight them
            let ap1 = null, ap2 = null;
            if (activeMatchId && lastMatchSnapshot[activeMatchId] !== undefined) {
                // We need the tournament_playerX_id from the original matcher
                // But it's easier to find the match in tournamentStages
                for (const stage of (tournamentStages || [])) {
                    for (const pool of (stage.pools || [])) {
                        for (const round of (pool.rounds || [])) {
                            for (const match of (round.matches || [])) {
                                if (match.id === activeMatchId) {
                                    ap1 = match.tournament_player1_id;
                                    ap2 = match.tournament_player2_id;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            playersData.forEach((p, idx) => {
                // Migrar al vuelo si viene del formato viejo
                migrateSocials(p);

                const tr = document.createElement('tr');
                if (p.id === ap1 || p.id === ap2) {
                    tr.className = 'active-player-row';
                }

                const flagImg = `<img src="./banderas/${p.flag}.png" class="resource-img" onerror="this.style.display='none'">`;
                const shieldImg = p.shield
                    ? `<img src="./escudos/${p.shield}" class="resource-img" onerror="this.style.display='none'">`
                    : `<span class="picker-item-none">+</span>`;

                // Construir celda de redes sociales
                const socialsCell = buildSocialsCell(idx, p.socials);

                tr.innerHTML = `
                <td style="color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                <td class="player-name-api">${p.apiName}</td>
                <td><input type="text" class="alias-input" value="${p.alias}" oninput="updateAlias(${idx}, this.value)" onkeydown="if(event.key==='Enter'){renderBracket();this.blur();}"></td>
                <td align="center"><button class="resource-btn" onclick="openPicker('flag', ${idx})">${flagImg}</button></td>
                <td align="center"><button class="resource-btn" onclick="openPicker('shield', ${idx})">${shieldImg}</button></td>
                <td></td>
            `;
                // Insertar la celda de socials con elementos reales (no innerHTML para poder bindear eventos)
                tr.lastElementChild.appendChild(socialsCell);
                tbody.appendChild(tr);
            });
        }

        function buildSocialsCell(playerIdx, socials) {
            const container = document.createElement('div');
            container.className = 'socials-container';

            socials.forEach((s, slotIdx) => {
                const slot = document.createElement('div');
                slot.className = 'social-slot';

                // Número de slot (sutil)
                const numLabel = document.createElement('span');
                numLabel.className = 'social-slot-number';
                numLabel.textContent = slotIdx + 1;
                slot.appendChild(numLabel);

                // Botón ícono de red
                const socialImg = s.type
                    ? `<img src="./redes/${s.type}" class="resource-img" onerror="this.style.display='none'">`
                    : `<span class="picker-item-none">+</span>`;
                const iconBtn = document.createElement('button');
                iconBtn.className = 'resource-btn';
                iconBtn.innerHTML = socialImg;
                iconBtn.onclick = () => openPicker('social', playerIdx, slotIdx);
                slot.appendChild(iconBtn);

                // Input handle
                const handleInput = document.createElement('input');
                handleInput.type = 'text';
                handleInput.className = 'social-input';
                handleInput.placeholder = '@usuario';
                handleInput.value = s.handle || '';
                handleInput.oninput = (e) => updateSocialHandle(playerIdx, slotIdx, e.target.value);
                slot.appendChild(handleInput);

                // Botón quitar (solo si hay más de 1 slot)
                if (socials.length > 1) {
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn-remove-social';
                    removeBtn.title = 'Quitar esta red';
                    removeBtn.innerHTML = '✕';
                    removeBtn.onclick = () => removeSocialSlot(playerIdx, slotIdx);
                    slot.appendChild(removeBtn);
                }

                container.appendChild(slot);
            });

            // Botón + (si hay menos de 3 slots)
            if (socials.length < 3) {
                const addBtn = document.createElement('button');
                addBtn.className = 'btn-add-social';
                addBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Red`;
                addBtn.onclick = () => addSocialSlot(playerIdx);
                container.appendChild(addBtn);
            }

            return container;
        }

        function updateAlias(idx, val) {
            playersData[idx].alias = val;
            saveData();
            renderBracket();
            broadcastPlayersUpdate();
        }

        function updateData(idx, field, val) {
            playersData[idx][field] = val;
            saveData();
        }

        function updateSocialHandle(playerIdx, slotIdx, val) {
            playersData[playerIdx].socials[slotIdx].handle = val;
            saveData();
            broadcastPlayersUpdate();
        }

        function addSocialSlot(playerIdx) {
            const p = playersData[playerIdx];
            if (p.socials.length >= 3) return;
            const newSlotIdx = p.socials.length; // 0-based: si ya hay 1, el nuevo es índice 1
            const defType = defaults.socials[newSlotIdx] || '';
            p.socials.push({ type: defType, handle: '' });
            saveData();
            broadcastSocialCount();
            renderTable();
            broadcastPlayersUpdate();
            refreshMatchDrawerIfActive();
        }

        function removeSocialSlot(playerIdx, slotIdx) {
            const p = playersData[playerIdx];
            if (p.socials.length <= 1) return;
            p.socials.splice(slotIdx, 1);
            saveData();
            broadcastSocialCount();
            renderTable();
            broadcastPlayersUpdate();
            refreshMatchDrawerIfActive();
        }

        function broadcastPlayersUpdate() {
            fgcChannel.postMessage({
                type: 'PLAYERS_UPDATE',
                payload: {
                    players: playersData.map(p => ({
                        id: p.id, alias: p.alias, flag: p.flag,
                        shield: p.shield,
                        socials: p.socials || [{ type: '', handle: '' }]
                    }))
                }
            });
        }

        // Señal para que Arquitecto sepa cuántos slots de red social hay por jugador
        function broadcastSocialCount() {
            fgcChannel.postMessage({
                type: 'SOCIAL_SLOTS_UPDATE',
                payload: {
                    players: playersData.map(p => ({
                        id: p.id,
                        socialCount: (p.socials || []).length
                    }))
                }
            });
        }

        // =====================================================
        //  PICKER (MODAL) CON BÚSQUEDA
        // =====================================================
        function openPicker(type, playerIdx, slotIdx = 0) {
            currentPicker = { active: true, type, playerIndex: playerIdx, slotIndex: slotIdx };
            const overlay = document.getElementById('picker-overlay');
            const grid = document.getElementById('picker-grid');
            const searchInput = document.getElementById('picker-search');
            grid.innerHTML = '';
            searchInput.value = '';

            document.getElementById('picker-title').innerText = `Seleccionar ${type === 'flag' ? 'Bandera' : type === 'shield' ? 'Escudo' : 'Red Social'}`;

            if (type === 'flag') {
                pickerAllItems = RESOURCES.flags.map(f => ({
                    value: f.code,
                    label: f.name,
                    imgSrc: `./banderas/${f.code}.png`
                }));
            } else if (type === 'shield') {
                pickerAllItems = RESOURCES.shields.map(s => ({
                    value: s,
                    label: s.replace(/\.[^/.]+$/, ''),
                    imgSrc: `./escudos/${s}`
                }));
            } else {
                pickerAllItems = RESOURCES.socials.map(s => ({
                    value: s,
                    label: s.replace(/\.[^/.]+$/, ''),
                    imgSrc: `./redes/${s}`
                }));
            }

            if (type !== 'flag') {
                const noneDiv = document.createElement('div');
                noneDiv.className = 'picker-item';
                noneDiv.innerHTML = '<span class="picker-item-none">✕ Quitar</span>';
                noneDiv.onclick = () => selectItem('');
                grid.appendChild(noneDiv);
            }

            renderPickerItems(pickerAllItems);
            overlay.classList.add('visible');
            setTimeout(() => searchInput.focus(), 100);
        }

        function renderPickerItems(items) {
            const grid = document.getElementById('picker-grid');
            const quitar = grid.querySelector('.picker-item');
            const hasQuitar = quitar && quitar.innerText.includes('Quitar');
            grid.innerHTML = '';
            if (hasQuitar && currentPicker.type !== 'flag') {
                const noneDiv = document.createElement('div');
                noneDiv.className = 'picker-item';
                noneDiv.innerHTML = '<span class="picker-item-none">✕ Quitar</span>';
                noneDiv.onclick = () => selectItem('');
                grid.appendChild(noneDiv);
            }

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'picker-item';
                div.innerHTML = `
                <img src="${item.imgSrc}" onerror="this.style.display='none'">
                <span class="picker-item-label">${item.label}</span>
            `;
                div.onclick = () => selectItem(item.value);
                grid.appendChild(div);
            });
        }

        function filterPicker(term) {
            const lower = term.toLowerCase();
            const filtered = pickerAllItems.filter(item =>
                item.label.toLowerCase().includes(lower) || item.value.toLowerCase().includes(lower)
            );
            renderPickerItems(filtered);
        }

        function closePicker(force = false) {
            if (force || event.target.id === 'picker-overlay') {
                document.getElementById('picker-overlay').classList.remove('visible');
                currentPicker.active = false;
            }
        }

        function selectItem(value) {
            if (!currentPicker.active) return;
            const type = currentPicker.type;

            if (currentPicker.isDefault) {
                if (type === 'flag') {
                    const found = RESOURCES.flags.find(f => f.code === value);
                    defaults.flag = found ? { code: found.code, name: found.name } : null;
                    if (found) {
                        document.getElementById('default-flag-img').src = `./banderas/${found.code}.png`;
                        document.getElementById('default-flag-label').textContent = found.name;
                    }
                } else if (type === 'shield') {
                    defaults.shield = value || null;
                    const img = document.getElementById('default-shield-img');
                    const ph = document.getElementById('default-shield-ph');
                    const lbl = document.getElementById('default-shield-label');
                    if (value) {
                        img.src = `./escudos/${value}`; img.style.display = 'block'; ph.style.display = 'none';
                        lbl.textContent = value.replace(/\.[^/.]+$/, ''); lbl.style.fontStyle = 'normal'; lbl.style.color = 'var(--text-main)';
                    } else {
                        img.style.display = 'none'; ph.style.display = '';
                        lbl.textContent = 'Ninguno'; lbl.style.fontStyle = 'italic'; lbl.style.color = 'var(--text-muted)';
                    }
                } else if (type === 'social') {
                    const slot = currentPicker.defaultSocialSlot || 1;
                    defaults.socials[slot - 1] = value || null;
                    const img = document.getElementById(`default-social-img-${slot}`);
                    const ph  = document.getElementById(`default-social-ph-${slot}`);
                    const lbl = document.getElementById(`default-social-label-${slot}`);
                    if (value) {
                        img.src = `./redes/${value}`; img.style.display = 'block'; ph.style.display = 'none';
                        lbl.textContent = value.replace(/\.[^/.]+$/, ''); lbl.style.fontStyle = 'normal'; lbl.style.color = 'var(--text-main)';
                    } else {
                        img.style.display = 'none'; ph.style.display = '';
                        lbl.textContent = 'Ninguna'; lbl.style.fontStyle = 'italic'; lbl.style.color = 'var(--text-muted)';
                    }
                }
                saveDefaults();
                closePicker(true);
                return;
            }

            const field = type === 'social' ? 'socialType' : type;
            if (type === 'social') {
                const slotIdx = currentPicker.slotIndex || 0;
                playersData[currentPicker.playerIndex].socials[slotIdx].type = value;
                saveData();
            } else {
                updateData(currentPicker.playerIndex, field, value);
            }
            renderTable();
            renderBracket();
            broadcastPlayersUpdate();
            refreshMatchDrawerIfActive();
            closePicker(true);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePicker(true);
        });

        // =====================================================
        //  AJUSTES — Valores por defecto
        // =====================================================
        const defaults = {
            flag: JSON.parse(localStorage.getItem('fgc_default_flag') || '{"code":"do","name":"Republica Dominicana"}'),
            shield: JSON.parse(localStorage.getItem('fgc_default_shield') || 'null') || null,
            socials: JSON.parse(localStorage.getItem('fgc_default_socials') || '[null,null,null]'),
        };

        function saveDefaults() {
            localStorage.setItem('fgc_default_flag', JSON.stringify(defaults.flag));
            localStorage.setItem('fgc_default_shield', JSON.stringify(defaults.shield));
            localStorage.setItem('fgc_default_socials', JSON.stringify(defaults.socials));
        }

        function applyDefaultsUI() {
            if (defaults.flag) {
                document.getElementById('default-flag-img').src = `./banderas/${defaults.flag.code}.png`;
                document.getElementById('default-flag-label').textContent = defaults.flag.name;
            }
            if (defaults.shield) {
                const img = document.getElementById('default-shield-img');
                img.src = `./escudos/${defaults.shield}`;
                img.style.display = 'block';
                document.getElementById('default-shield-ph').style.display = 'none';
                document.getElementById('default-shield-label').textContent = defaults.shield.replace(/\.[^/.]+$/, '');
                document.getElementById('default-shield-label').style.fontStyle = 'normal';
                document.getElementById('default-shield-label').style.color = 'var(--text-main)';
            }
            // Renderizar los 3 slots de red social
            [1, 2, 3].forEach(slot => {
                const val = defaults.socials[slot - 1];
                const img = document.getElementById(`default-social-img-${slot}`);
                const ph  = document.getElementById(`default-social-ph-${slot}`);
                const lbl = document.getElementById(`default-social-label-${slot}`);
                if (val) {
                    img.src = `./redes/${val}`;
                    img.style.display = 'block';
                    ph.style.display = 'none';
                    lbl.textContent = val.replace(/\.[^/.]+$/, '');
                    lbl.style.fontStyle = 'normal';
                    lbl.style.color = 'var(--text-main)';
                } else {
                    img.style.display = 'none';
                    ph.style.display = '';
                    lbl.textContent = 'Ninguna';
                    lbl.style.fontStyle = 'italic';
                    lbl.style.color = 'var(--text-muted)';
                }
            });
        }

        function openSettings() {
            document.getElementById('settings-overlay').classList.add('visible');
        }
        function closeSettings() {
            document.getElementById('settings-overlay').classList.remove('visible');
        }

        function openDefaultPicker(type, socialSlot = 1) {
            currentPicker = { active: true, type, playerIndex: null, isDefault: true, defaultSocialSlot: socialSlot };
            const overlay = document.getElementById('picker-overlay');
            const grid = document.getElementById('picker-grid');
            const searchInput = document.getElementById('picker-search');
            grid.innerHTML = '';
            searchInput.value = '';

            document.getElementById('picker-title').innerText = `Defecto — ${type === 'flag' ? 'Bandera' : type === 'shield' ? 'Escudo' : 'Red Social'}`;

            if (type === 'flag') {
                pickerAllItems = RESOURCES.flags.map(f => ({
                    value: f.code, label: f.name, imgSrc: `./banderas/${f.code}.png`
                }));
            } else if (type === 'shield') {
                pickerAllItems = RESOURCES.shields.map(s => ({
                    value: s, label: s.replace(/\.[^/.]+$/, ''), imgSrc: `./escudos/${s}`
                }));
            } else {
                pickerAllItems = RESOURCES.socials.map(s => ({
                    value: s, label: s.replace(/\.[^/.]+$/, ''), imgSrc: `./redes/${s}`
                }));
            }

            if (type !== 'flag') {
                const noneDiv = document.createElement('div');
                noneDiv.className = 'picker-item';
                noneDiv.innerHTML = '<span class="picker-item-none">✕ Quitar</span>';
                noneDiv.onclick = () => selectItem('');
                grid.appendChild(noneDiv);
            }

            renderPickerItems(pickerAllItems);
            overlay.classList.add('visible');
            setTimeout(() => searchInput.focus(), 100);
        }

        function applyDefaultToAll(type) {
            if (!playersData || playersData.length === 0) {
                showToast('No hay participantes cargados', 'info'); return;
            }
            if (type === 'flag') {
                if (!defaults.flag) { showToast('Selecciona una bandera primero', 'info'); return; }
                playersData.forEach(p => p.flag = defaults.flag.code);
                showToast(`Bandera aplicada a ${playersData.length} participantes`, 'success');
            } else if (type === 'shield') {
                playersData.forEach(p => p.shield = defaults.shield || '');
                const msg = defaults.shield
                    ? `Escudo aplicado a ${playersData.length} participantes`
                    : `Escudo eliminado de ${playersData.length} participantes`;
                showToast(msg, 'success');
            } else if (type === 'social') {
                // Contar cuántos slots tienen imagen (0 = reset total)
                let activeCount = 0;
                defaults.socials.forEach((val, i) => { if (val) activeCount = i + 1; });

                playersData.forEach(p => {
                    migrateSocials(p);
                    if (activeCount === 0) {
                        // Reset: dejar solo un slot vacío
                        p.socials = [{ type: '', handle: '' }];
                    } else {
                        p.socials = defaults.socials.slice(0, activeCount).map(val => ({
                            type: val || '',
                            handle: ''
                        }));
                    }
                });
                broadcastSocialCount();
                const msg = activeCount === 0
                    ? `Redes sociales eliminadas de ${playersData.length} participantes`
                    : `${activeCount} red(es) social(es) aplicada(s) a ${playersData.length} participantes`;
                showToast(msg, 'success');
            }
            saveData();
            renderTable();
            renderBracket();
            closeSettings();
        }

        // =====================================================
        //  BRACKET — Render por formato de torneo
        // =====================================================
        function renderBracket() {
            const container = document.getElementById('bracket-render');
            const hint = document.getElementById('bracket-hint');
            container.innerHTML = '';

            if (!tournamentStages || tournamentStages.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); font-style:italic; text-align:center; margin-top:40px;">El bracket aún no ha sido generado en Round.One.</p>';
                hint.style.display = 'none';
                return;
            }

            let hasBracket = false;

            tournamentStages.forEach((stage) => {
                if (!stage.pools || stage.pools.length === 0) return;

                const format = detectFormat(stage);
                const poolLabel = stage.pools.length > 1;

                stage.pools.forEach((pool, poolIdx) => {
                    if (!pool.rounds || pool.rounds.length === 0) return;
                    hasBracket = true;

                    const suffix = poolLabel ? ` · Pool ${pool.number || poolIdx + 1}` : '';

                    if (format === 'double_elimination') {
                        renderDoubleElimination(container, pool, suffix);
                    } else if (format === 'single_elimination') {
                        renderSingleElimination(container, pool, suffix);
                    } else if (format === 'round_robin') {
                        renderRoundRobin(container, pool, suffix);
                    } else if (format === 'lobby') {
                        renderLobby(container, pool, suffix);
                    }
                });
            });

            if (!hasBracket) {
                container.innerHTML = '<p style="color:var(--text-muted); font-style:italic; text-align:center; margin-top:40px;">El bracket está vacío o aún no tiene combates.</p>';
                hint.style.display = 'none';
            } else {
                hint.style.display = 'block';
                requestAnimationFrame(() => drawConnectors());
            }
        }

        // ---- Double Elimination — lógica original restaurada ----
        function renderDoubleElimination(container, pool, suffix) {
            const allRounds = (pool.rounds || []).slice().sort((a, b) => a.number - b.number);
            const winnersRounds = allRounds.filter(r => r.losers === 0);
            const losersRounds = allRounds.filter(r => r.losers === 1);

            // Detectar Grand Finals: últimas rondas winners donde todos los matches no tienen winner_match_id
            let grandRounds = [];
            const wRounds = winnersRounds.slice();
            while (wRounds.length > 0) {
                const last = wRounds[wRounds.length - 1];
                const allGF = last.matches && last.matches.length > 0 &&
                    last.matches.every(m => m.winner_match_id === null);
                if (allGF) grandRounds.unshift(wRounds.pop());
                else break;
            }

            const wTotal = wRounds.length;
            const lTotal = losersRounds.length;

            // Nombres winners desde el final hacia atrás (lógica original)
            const getWinnersRoundName = (idx, total) => {
                const fromEnd = total - idx;
                if (fromEnd === 1) return 'Winners Finals';
                if (fromEnd === 2) return 'Winners Semi-Finals';
                if (fromEnd === 3) return 'Winners Quarter-Finals';
                return `Winners Round ${idx + 1}`;
            };

            // Nombres losers desde el final hacia atrás (lógica original)
            const getLosersRoundName = (idx, total) => {
                const fromEnd = total - idx;
                if (fromEnd === 1) return 'Losers Finals';
                if (fromEnd === 2) return 'Losers Semi-Finals';
                if (fromEnd === 3) return 'Losers Quarter-Finals';
                return `Losers Round ${idx + 1}`;
            };

            const allWinnersBlock = [
                ...wRounds.map((r, i) => ({ ...r, _displayName: getWinnersRoundName(i, wTotal) })),
                ...grandRounds.map((r, i) => ({ ...r, _displayName: i === 0 ? 'Grand Finals' : 'Extra Grand Finals' }))
            ];

            if (allWinnersBlock.length > 0) {
                container.appendChild(buildBracketSection(
                    `Winners Bracket${suffix}`, allWinnersBlock, 'winners', 'double_elimination'
                ));
            }

            if (losersRounds.length > 0) {
                const lNamed = losersRounds.map((r, i) => ({ ...r, _displayName: getLosersRoundName(i, lTotal) }));
                container.appendChild(buildBracketSection(
                    `Losers Bracket${suffix}`, lNamed, 'losers', 'double_elimination'
                ));
            }
        }

        // ---- Single Elimination ----
        function renderSingleElimination(container, pool, suffix) {
            const rounds = (pool.rounds || []).slice().sort((a, b) => a.number - b.number);

            // Detect bronze at round level or match level
            const isBronzeRound = (r) => {
                if (r.is_third_place || r.third_place || r.bronze) return true;
                const rn = (r.name || '').toLowerCase();
                if (rn.includes('bronze') || rn.includes('tercer') || rn.includes('third')) return true;
                // Check individual matches for bronze indicators
                if (r.matches && r.matches.some(m => {
                    const mn = (m.name || m.label || m.round_name || '').toLowerCase();
                    return mn.includes('bronze') || mn.includes('third') || mn.includes('tercer') ||
                        m.is_third_place || m.third_place || m.bronze;
                })) return true;
                return false;
            };

            // Separate bronze rounds from normal rounds
            const normalRounds = [];
            const bronzeRounds = [];

            rounds.forEach(r => {
                if (isBronzeRound(r)) bronzeRounds.push(r);
                else normalRounds.push(r);
            });

            const total = normalRounds.length;

            // Use round name from API if available, otherwise generate from position
            const getSingleRoundName = (r, idx, total) => {
                // Respect the name from Round.one if present
                if (r.name && r.name.trim()) return r.name;
                const fromEnd = total - idx;
                if (fromEnd === 1) return 'Grand Finals';
                if (fromEnd === 2) return 'Semi-Finals';
                if (fromEnd === 3) return 'Quarter-Finals';
                return `Round ${idx + 1}`;
            };

            const named = normalRounds.map((r, i) => ({
                ...r,
                _displayName: getSingleRoundName(r, i, total)
            }));

            // Bronze rounds from API
            const bronzeNamed = bronzeRounds.map(r => ({
                ...r,
                _displayName: 'Bronze',
                _isBronze: true
            }));

            // If no explicit bronze round was found, check if the tournament has third-place enabled.
            // Round.one puts the bronze match as a separate round that has matches between the 
            // losers of semi-finals. We insert a synthetic bronze column if semi-finals exist
            // and there are matches in normalRounds whose match data hints at bronze.
            // Also look inside the last round (Grand Finals) for any match that could be bronze.
            if (bronzeNamed.length === 0 && normalRounds.length >= 2) {
                // Check the Grand Finals round for any match that might actually be bronze
                const gfRound = normalRounds[normalRounds.length - 1];
                if (gfRound.matches && gfRound.matches.length > 1) {
                    const bronzeMatches = gfRound.matches.filter(m => {
                        const mn = (m.name || m.label || m.round_name || '').toLowerCase();
                        return mn.includes('bronze') || mn.includes('third') || mn.includes('tercer') ||
                            m.is_third_place || m.third_place || m.bronze;
                    });
                    if (bronzeMatches.length > 0) {
                        // Remove bronze matches from Grand Finals and make a separate column
                        gfRound.matches = gfRound.matches.filter(m => !bronzeMatches.includes(m));
                        bronzeNamed.push({
                            matches: bronzeMatches,
                            _displayName: 'Bronze',
                            _isBronze: true,
                            required_score: gfRound.required_score
                        });
                    }
                }
            }

            // Insert bronze before Grand Finals (same position as Round.one)
            let allNamed;
            if (bronzeNamed.length > 0 && named.length >= 1) {
                // Insert bronze right before the last round (Grand Finals)
                allNamed = [...named.slice(0, -1), ...bronzeNamed, named[named.length - 1]];
            } else {
                allNamed = [...named, ...bronzeNamed];
            }

            if (allNamed.length > 0) {
                container.appendChild(buildBracketSection(
                    `Single Elimination${suffix}`, allNamed, 'single', 'single_elimination'
                ));
            }
        }

        // ---- Round Robin ----
        function renderRoundRobin(container, pool, suffix) {
            const rounds = (pool.rounds || []).slice().sort((a, b) => a.number - b.number);
            const named = rounds.map(r => ({
                ...r,
                _displayName: r.name || `Ronda ${r.number}`,
                _isRoundRobin: true
            }));

            if (named.length > 0) {
                container.appendChild(buildBracketSection(
                    `Round Robin${suffix}`, named, 'roundrobin', 'round_robin'
                ));
            }
        }

        // ---- Lobby ----
        function renderLobby(container, pool, suffix) {
            const rounds = (pool.rounds || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));

            // If no rounds defined by API, create a synthetic one with all matches
            let named;
            if (rounds.length === 0) {
                // Treat all matches in pool as a single exhibition block
                named = [{ id: `lobby_${pool.id || 0}`, matches: pool.matches || [], _displayName: null, _isLobby: true }];
            } else {
                named = rounds.map(r => ({
                    ...r,
                    _displayName: null, // will be handled by lobby name logic
                    _isLobby: true
                }));
            }

            if (named.length > 0) {
                container.appendChild(buildBracketSection(
                    `Lobby${suffix}`, named, 'lobby', 'lobby'
                ));
            }
        }

        // =====================================================
        //  BRACKET LAYOUT ENGINE
        // =====================================================
        const CARD_H = 76;
        const CARD_GAP = 8;
        const HEADER_H = 44;

        function buildBracketSection(titleText, rounds, typeClass, format) {
            const section = document.createElement('div');
            section.className = 'bracket-section';

            const title = document.createElement('div');
            title.className = `bracket-title ${typeClass}`;
            title.innerText = titleText;
            section.appendChild(title);

            const stage = document.createElement('div');
            stage.className = 'bracket-stage';
            stage.dataset.bracketType = typeClass;

            const maxMatchCount = Math.max(...rounds.map(r => r.matches?.length || 1));
            const baseSlotH = CARD_H + CARD_GAP;
            const totalContentH = maxMatchCount * baseSlotH - CARD_GAP;
            const totalH = HEADER_H + totalContentH;

            rounds.forEach((round, roundIdx) => {
                const isLast = roundIdx === rounds.length - 1;
                const matchCount = round.matches?.length || 1;
                const slotsPerMatch = maxMatchCount / matchCount;
                const slotH = slotsPerMatch * baseSlotH;

                const wrapper = document.createElement('div');
                wrapper.className = 'bracket-round-wrapper';

                const roundCol = document.createElement('div');
                roundCol.className = 'bracket-round';
                roundCol.style.height = `${totalH}px`;

                // Build round header
                const header = document.createElement('div');
                header.className = 'round-header';

                // Resolve the round name (for editable formats, use custom name from customRoundNames)
                const isEditable = round._isLobby || round._isRoundRobin;
                let resolvedRoundName;
                if (isEditable) {
                    const customKey = `custom_round_${round.id || roundIdx}`;
                    const defaultName = round._isLobby
                        ? 'Exhibition Match'
                        : (round._displayName || round.name || `Ronda ${round.number}`);
                    resolvedRoundName = customRoundNames[customKey] || defaultName;
                } else {
                    resolvedRoundName = round._displayName || round.name || `Round ${round.number}`;
                }

                if (isEditable) {
                    // Editable round name (Lobby & Round Robin)
                    const customKey = `custom_round_${round.id || roundIdx}`;
                    const isRR = !!round._isRoundRobin;
                    const editColorVar = isRR ? 'var(--color-roundrobin)' : 'var(--color-lobby)';
                    const editCssClass = isRR ? 'roundrobin-edit' : '';
                    const defaultName = round._isLobby ? 'Exhibition Match' : (round._displayName || round.name || `Ronda ${round.number}`);

                    const wrapper2 = document.createElement('div');
                    wrapper2.className = 'editable-round-name-wrapper';

                    const nameEl = document.createElement('span');
                    nameEl.className = `editable-round-name ${editCssClass}`;
                    nameEl.textContent = resolvedRoundName;
                    nameEl.title = 'Haz clic para editar';

                    const pencilIcon = document.createElement('span');
                    pencilIcon.className = 'editable-edit-icon';
                    pencilIcon.innerHTML = `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         stroke="${editColorVar}" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round"
                         style="transform: rotate(230deg);">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                `;

                    const startEdit = () => {
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.className = `editable-round-input ${editCssClass}`;
                        input.value = nameEl.textContent;
                        input.maxLength = 40;

                        const finishEdit = () => {
                            const val = input.value.trim() || defaultName;
                            customRoundNames[customKey] = val;
                            nameEl.textContent = val;
                            saveData();
                            // Swap input back to display
                            wrapper2.replaceChild(nameEl, input);
                            wrapper2.appendChild(pencilIcon);
                            // Instant update: re-render bracket and re-send active match if applicable
                            renderBracket();
                            resendActiveMatchIfNeeded();
                        };

                        input.addEventListener('blur', finishEdit);
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
                            if (e.key === 'Escape') {
                                wrapper2.replaceChild(nameEl, input);
                                wrapper2.appendChild(pencilIcon);
                            }
                        });

                        // Swap display for input
                        wrapper2.replaceChild(input, nameEl);
                        pencilIcon.remove();
                        input.focus();
                        input.select();
                    };

                    nameEl.addEventListener('click', startEdit);
                    pencilIcon.addEventListener('click', startEdit);

                    wrapper2.appendChild(nameEl);
                    wrapper2.appendChild(pencilIcon);
                    header.appendChild(wrapper2);
                } else {
                    // Normal round header
                    const rName = document.createElement('span');
                    rName.className = 'round-name';
                    rName.innerText = resolvedRoundName;
                    header.appendChild(rName);
                }

                // FT label (non-lobby)
                if (!round._isLobby && round.required_score) {
                    const bestOf = (round.required_score * 2) - 1;
                    const ftLabel = document.createElement('span');
                    ftLabel.className = 'round-ft';
                    ftLabel.innerText = `FT${round.required_score} · Best of ${bestOf}`;
                    header.appendChild(ftLabel);
                }

                roundCol.appendChild(header);

                // Place match cards
                if (round.matches) {
                    round.matches.forEach((match, mIdx) => {
                        const isBronzeMatch = round._isBronze || match.is_third_place || match.third_place || match.bronze ||
                            ((match.name || match.label || '').toLowerCase().includes('bronze'));
                        // Use resolvedRoundName so lobby custom names reach the controller
                        const card = buildMatchCard(match, resolvedRoundName, round.required_score, format, isBronzeMatch);
                        const slotCenter = HEADER_H + mIdx * slotH + slotH / 2;
                        card.style.top = `${slotCenter - CARD_H / 2}px`;
                        card.style.height = `${CARD_H}px`;
                        roundCol.appendChild(card);
                    });
                }

                wrapper.appendChild(roundCol);

                if (!isLast) {
                    const connector = document.createElement('div');
                    connector.className = 'round-connector';
                    connector.style.height = `${totalH}px`;
                    connector.dataset.roundIdx = roundIdx;
                    wrapper.appendChild(connector);
                }

                stage.appendChild(wrapper);
            });

            section.appendChild(stage);
            return section;
        }

        // =====================================================
        //  SVG CONNECTORS
        // =====================================================
        function drawConnectors() {
            document.querySelectorAll('.bracket-stage').forEach(stage => {
                const typeClass = stage.dataset.bracketType || 'winners';
                const colorMap = {
                    winners: '#00f2ff',
                    losers: '#ffb000',
                    grands: '#bc13fe',
                    single: '#22c55e',
                    roundrobin: '#bc13fe',
                    lobby: '#f06292'
                };
                const color = colorMap[typeClass] || '#00f2ff';

                const wrappers = Array.from(stage.querySelectorAll('.bracket-round-wrapper'));

                wrappers.forEach((wrapper, wIdx) => {
                    const connector = wrapper.querySelector('.round-connector');
                    if (!connector) return;

                    const nextWrapper = wrappers[wIdx + 1];
                    if (!nextWrapper) return;

                    const fromCards = Array.from(wrapper.querySelectorAll('.match-card'));
                    const toCards = Array.from(nextWrapper.querySelectorAll('.match-card'));
                    if (!fromCards.length || !toCards.length) return;

                    const connH = connector.offsetHeight;
                    const connW = connector.offsetWidth;
                    connector.innerHTML = '';

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.style.cssText = `position:absolute;top:0;left:0;width:${connW}px;height:${connH}px;overflow:visible;`;
                    svg.setAttribute('width', connW);
                    svg.setAttribute('height', connH);
                    connector.appendChild(svg);

                    const connTop = connector.getBoundingClientRect().top;
                    const mid = connW / 2;

                    const pairCount = toCards.length;
                    const srcPerDest = fromCards.length / pairCount;

                    for (let i = 0; i < pairCount; i++) {
                        const destCard = toCards[i];
                        const rDest = destCard.getBoundingClientRect();
                        const yDest = rDest.top + rDest.height / 2 - connTop;

                        const srcStart = Math.round(i * srcPerDest);
                        const srcEnd = Math.round((i + 1) * srcPerDest);
                        const srcCards = fromCards.slice(srcStart, srcEnd);

                        if (srcCards.length === 0) continue;

                        const ySrc = srcCards.map(c => {
                            const r = c.getBoundingClientRect();
                            return r.top + r.height / 2 - connTop;
                        });

                        const yTop = ySrc[0];
                        const yBot = ySrc[ySrc.length - 1];
                        const yMid = (yTop + yBot) / 2;

                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        let d = '';

                        if (srcCards.length === 1) {
                            d = `M0,${yTop} H${connW}`;
                        } else {
                            ySrc.forEach(y => { d += `M0,${y} H${mid} `; });
                            d += `M${mid},${yTop} V${yBot} `;
                            d += `M${mid},${yMid} H${connW}`;
                        }

                        path.setAttribute('d', d.trim());
                        path.setAttribute('stroke', color);
                        path.setAttribute('stroke-width', '1.5');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke-opacity', '0.35');
                        path.setAttribute('stroke-linecap', 'round');
                        path.setAttribute('stroke-linejoin', 'round');
                        svg.appendChild(path);
                    }
                });
            });
        }

        // =====================================================
        //  BUILD MATCH CARD
        // =====================================================
        function buildMatchCard(match, roundName, requiredScore, format, isBronzeMatch) {
            const card = document.createElement('div');
            card.className = 'match-card';
            const isFinished = match.winner !== null && match.winner !== undefined;
            if (isFinished) card.classList.add('finished');
            if (match.id === activeMatchId && !isFinished) card.classList.add('active-match');
            if (isBronzeMatch) card.classList.add('bronze-match');

            // Bronze badge
            if (isBronzeMatch) {
                const badge = document.createElement('div');
                badge.className = 'bronze-badge';
                badge.textContent = '🥉 Bronze';
                card.appendChild(badge);
            }

            const p1 = playersData.find(p => p.id === match.tournament_player1_id);
            const p2 = playersData.find(p => p.id === match.tournament_player2_id);

            const buildPlayerRow = (pData, score, isWinner, isLoser) => {
                const flagSrc = pData?.flag ? `./banderas/${pData.flag}.png` : '';
                const shieldSrc = pData?.shield ? `./escudos/${pData.shield}` : '';
                const name = pData ? pData.alias : 'TBD';
                const isTbd = !pData;

                const winClass = isWinner ? 'winner' : isLoser ? 'loser' : '';

                const row = document.createElement('div');
                row.className = `match-player ${winClass}`;

                const info = document.createElement('div');
                info.className = 'match-player-info';

                if (flagSrc) {
                    const flag = document.createElement('img');
                    flag.className = 'match-flag-small';
                    flag.src = flagSrc;
                    flag.onerror = () => flag.style.display = 'none';
                    info.appendChild(flag);
                }
                if (shieldSrc) {
                    const shield = document.createElement('img');
                    shield.className = 'match-shield-small';
                    shield.src = shieldSrc;
                    shield.onerror = () => shield.style.display = 'none';
                    info.appendChild(shield);
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = `match-player-name${isTbd ? ' tbd' : ''}`;
                nameSpan.textContent = name;
                info.appendChild(nameSpan);

                const scoreSpan = document.createElement('span');
                scoreSpan.className = 'match-score';
                scoreSpan.textContent = isFinished ? (score ?? 0) : (score ?? '–');

                row.appendChild(info);
                row.appendChild(scoreSpan);

                return row;
            };

            const p1Winner = match.winner === 1;
            const p2Winner = match.winner === 2;
            const hasWinner = match.winner !== null && match.winner !== undefined;

            card.appendChild(buildPlayerRow(p1, match.player1_score, p1Winner, hasWinner && !p1Winner));
            card.appendChild(buildPlayerRow(p2, match.player2_score, p2Winner, hasWinner && !p2Winner));

            const idBadge = document.createElement('span');
            idBadge.className = 'match-id-badge';
            idBadge.textContent = `#${match.id}`;
            card.appendChild(idBadge);

            card.addEventListener('click', () => {
                if (isFinished) {
                    showToast('Esta partida ya fue jugada', 'error');
                    return;
                }
                const missingBoth = !match.tournament_player1_id && !match.tournament_player2_id;
                const missingOne = !match.tournament_player1_id || !match.tournament_player2_id;
                if (missingBoth) {
                    showToast('Faltan ambos jugadores en esta partida', 'error');
                    return;
                }
                if (missingOne) {
                    showToast('Falta un jugador en esta partida', 'error');
                    return;
                }
                selectActiveMatch(match, roundName, requiredScore, format);
            });

            return card;
        }

        // =====================================================
        //  SELECT ACTIVE MATCH — envío al Controlador
        // =====================================================
        /**
         * p1Side / p2Side solo aplica a Double Elimination Grand Finals.
         * Para todos los demás formatos, se manda null.
         */
        function getSides(roundName, format) {
            if (format !== 'double_elimination') return { p1Side: null, p2Side: null };
            const r = (roundName || '').trim();
            if (r === 'Extra Grand Finals') return { p1Side: 'L', p2Side: 'L' };
            if (r === 'Grand Finals') return { p1Side: 'W', p2Side: 'L' };
            return { p1Side: null, p2Side: null };
        }

        function selectActiveMatch(match, roundName, requiredScore, format) {
            activeMatchId = match.id;

            const p1 = playersData.find(p => p.id === match.tournament_player1_id);
            const p2 = playersData.find(p => p.id === match.tournament_player2_id);

            const { p1Side, p2Side } = getSides(roundName, format);

            fgcChannel.postMessage({
                type: 'LOAD_MATCH',
                payload: {
                    match_id: match.id,
                    round: roundName,
                    required_score: requiredScore || null,
                    format: format,
                    p1Side,
                    p2Side,
                    p1: p1 ? {
                        name: p1.alias,
                        flag: p1.flag,
                        shield: p1.shield,
                        socials: p1.socials || [{ type: p1.socialType || '', handle: p1.socialHandle || '' }]
                    } : { name: 'TBD', flag: 'do', shield: '', socials: [{ type: '', handle: '' }] },
                    p2: p2 ? {
                        name: p2.alias,
                        flag: p2.flag,
                        shield: p2.shield,
                        socials: p2.socials || [{ type: p2.socialType || '', handle: p2.socialHandle || '' }]
                    } : { name: 'TBD', flag: 'do', shield: '', socials: [{ type: '', handle: '' }] }
                }
            });

            // Update drawer and table highlighting
            populateMatchDrawer(match, p1, p2, roundName);
            document.getElementById('drawer-toggle-btn').style.display = 'flex';
            document.getElementById('match-drawer').classList.add('open');
            renderTable();
            renderBracket();
            showToast(`Partida #${match.id} enviada al Controlador`, 'info');
        }

        // =====================================================
        //  MATCH DRAWER LOGIC
        // =====================================================
        function toggleMatchDrawer() {
            if (!activeMatchId) return;
            const drawer = document.getElementById('match-drawer');
            drawer.classList.toggle('open');
        }

        function populateMatchDrawer(match, p1, p2, roundName) {
            document.getElementById('drawer-subtitle').innerText = roundName || `Ronda del M #${match.id}`;
            const container = document.getElementById('drawer-content');
            container.innerHTML = '';

            const p1Idx = playersData.findIndex(p => p.id === match.tournament_player1_id);
            const p2Idx = playersData.findIndex(p => p.id === match.tournament_player2_id);

            container.appendChild(buildDrawerPlayerCard(1, p1, p1Idx));
            container.appendChild(buildDrawerPlayerCard(2, p2, p2Idx));
        }

        function buildDrawerPlayerCard(playerNum, p, idx) {
            const card = document.createElement('div');
            card.className = 'drawer-player-card';

            if (!p) {
                card.innerHTML = `<div class="drawer-player-label">JUGADOR ${playerNum}</div>
                                  <div class="drawer-empty-state">TBD / Por Determinar</div>`;
                return card;
            }

            const flagImg = `<img src="./banderas/${p.flag}.png" class="resource-img" onerror="this.style.display='none'">`;
            const shieldImg = p.shield
                ? `<img src="./escudos/${p.shield}" class="resource-img" onerror="this.style.display='none'">`
                : `<span class="picker-item-none">+ ESC</span>`;

            // Fixed 3 slots for socials
            const socialsHtml = [0, 1, 2].map(slotIdx => {
                const s = (p.socials && p.socials[slotIdx]) ? p.socials[slotIdx] : { type: '', handle: '' };
                const socialImg = s.type
                    ? `<img src="./redes/${s.type}" class="resource-img" onerror="this.style.display='none'">`
                    : `<span class="picker-item-none">+ RED</span>`;
                
                return `
                <div class="drawer-row" style="margin-bottom: 6px; gap: 6px;">
                    <div style="width: 50px;">
                        <button class="resource-btn" style="width:100%; height:32px;" onclick="openPickerDrawerSocial('social', ${idx}, ${slotIdx})">${socialImg}</button>
                    </div>
                    <div class="drawer-field" style="margin-bottom: 0; flex: 1;">
                        <input type="text" style="height:32px;" placeholder="@usuario o link" value="${s.handle}" 
                            oninput="updateSocialHandleDrawer(${idx}, ${slotIdx}, this.value)"
                            onfocus="ensureSocialSlotExists(${idx}, ${slotIdx})">
                    </div>
                </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="drawer-player-label">JUGADOR ${playerNum} — ${p.apiName}</div>
                <div class="drawer-field">
                    <label>Alias (En Pantalla)</label>
                    <input type="text" value="${p.alias}" 
                        oninput="updateAliasDrawer(${idx}, this.value)" 
                        onkeydown="if(event.key==='Enter'){this.blur();}">
                </div>
                <div class="drawer-row">
                    <div class="drawer-col">
                        <div class="drawer-field" style="margin-bottom:0;">
                            <label>Bandera</label>
                            <button class="resource-btn" style="width:100%; height:40px;" onclick="openPicker('flag', ${idx})">${flagImg}</button>
                        </div>
                    </div>
                    <div class="drawer-col">
                        <div class="drawer-field" style="margin-bottom:0;">
                            <label>Escudo</label>
                            <button class="resource-btn" style="width:100%; height:40px;" onclick="openPicker('shield', ${idx})">${shieldImg}</button>
                        </div>
                    </div>
                </div>
                <div class="drawer-field" style="margin-top: 12px; margin-bottom: 0;">
                    <label>Redes Sociales</label>
                    <div class="drawer-socials-container">
                        ${socialsHtml}
                    </div>
                </div>
            `;

            return card;
        }

        function ensureSocialSlotExists(playerIdx, slotIdx) {
            const p = playersData[playerIdx];
            if (!p.socials) p.socials = [];
            let changed = false;
            while (p.socials.length <= slotIdx) {
                p.socials.push({ type: '', handle: '' });
                changed = true;
            }
            if (changed) {
                broadcastSocialCount();
                saveData();
                // Opcional: renderTable si queremos que la tabla principal también lo muestre enseguida
                renderTable();
            }
        }

        function openPickerDrawerSocial(type, playerIdx, slotIdx) {
            ensureSocialSlotExists(playerIdx, slotIdx);
            openPicker(type, playerIdx, slotIdx);
        }

        // We need a specific function because updateAlias triggers renderBracket which might close inputs if not careful
        function updateAliasDrawer(idx, val) {
            playersData[idx].alias = val;
            saveData();
            broadcastPlayersUpdate();
            clearTimeout(window.drawerRenderTimeout);
            window.drawerRenderTimeout = setTimeout(() => {
                renderBracket();
                renderTable();
            }, 500);
        }

        function updateSocialHandleDrawer(playerIdx, slotIdx, val) {
            ensureSocialSlotExists(playerIdx, slotIdx);
            playersData[playerIdx].socials[slotIdx].handle = val;
            saveData();
            broadcastPlayersUpdate();
            clearTimeout(window.drawerRenderTimeout2);
            window.drawerRenderTimeout2 = setTimeout(() => {
                renderTable();
            }, 500);
        }

        function refreshMatchDrawerIfActive() {
            if (!activeMatchId) return;
            // Solo para refrescar imágenes/textos (no debe robar focus si el usuario está editando algo)
            let activeMatch = null;
            let activeRoundName = '';
            for (const stage of (tournamentStages || [])) {
                const format = detectFormat(stage);
                for (const pool of (stage.pools || [])) {
                    for (const round of (pool.rounds || [])) {
                        for (const match of (round.matches || [])) {
                            if (match.id === activeMatchId) {
                                activeMatch = match;
                                const customKey = `custom_round_${round.id}`;
                                const isLobbyFormat = format === 'lobby';
                                const isRRFormat = format === 'round_robin';
                                if (isLobbyFormat || isRRFormat) {
                                    activeRoundName = customRoundNames[customKey] || (isLobbyFormat ? 'Exhibition Match' : (round.name || `Ronda ${round.number}`));
                                } else {
                                    activeRoundName = round._displayName || round.name || `Round ${round.number}`;
                                }
                                break;
                            }
                        }
                    }
                }
            }
            if (activeMatch) {
                const p1 = playersData.find(p => p.id === activeMatch.tournament_player1_id);
                const p2 = playersData.find(p => p.id === activeMatch.tournament_player2_id);
                populateMatchDrawer(activeMatch, p1, p2, activeRoundName);
            }
        }

        /**
         * Re-sends the currently active match to the controller.
         * Used after editing a round name so the controller gets the updated name instantly.
         */
        function resendActiveMatchIfNeeded() {
            if (!activeMatchId) return;

            // Find the active match in the current stages
            for (const stage of (tournamentStages || [])) {
                const format = detectFormat(stage);
                for (const pool of (stage.pools || [])) {
                    for (const round of (pool.rounds || [])) {
                        for (const match of (round.matches || [])) {
                            if (match.id === activeMatchId) {
                                // Determine the resolved round name
                                const customKey = `custom_round_${round.id}`;
                                const isLobbyFormat = format === 'lobby';
                                const isRRFormat = format === 'round_robin';

                                let roundName;
                                if (isLobbyFormat || isRRFormat) {
                                    const defaultName = isLobbyFormat
                                        ? 'Exhibition Match'
                                        : (round.name || `Ronda ${round.number}`);
                                    roundName = customRoundNames[customKey] || defaultName;
                                } else {
                                    roundName = round._displayName || round.name || `Round ${round.number}`;
                                }

                                selectActiveMatch(match, roundName, round.required_score, format);
                                return;
                            }
                        }
                    }
                }
            }
        }

        // =====================================================
        //  TOAST
        // =====================================================
        let toastTimer = null;
        function showToast(msg, type = 'info') {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.className = `show ${type}`;
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toast.className = ''; }, 3000);
        }

        // =====================================================
        //  DRAG TO SCROLL — Bracket
        // =====================================================
        function initDragScroll() {
            const el = document.getElementById('tab-bracket');
            let isDragging = false;
            let startX, startY, scrollLeft, scrollTop;

            el.addEventListener('mousedown', (e) => {
                if (e.target.closest('.match-card') || e.target.closest('button') || e.target.closest('input')) return;
                isDragging = true;
                el.classList.add('dragging');
                startX = e.pageX - el.offsetLeft;
                startY = e.pageY - el.offsetTop;
                scrollLeft = el.scrollLeft;
                scrollTop = el.scrollTop;
            });

            el.addEventListener('mouseleave', () => {
                isDragging = false;
                el.classList.remove('dragging');
            });

            el.addEventListener('mouseup', () => {
                isDragging = false;
                el.classList.remove('dragging');
            });

            el.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - el.offsetLeft;
                const y = e.pageY - el.offsetTop;
                const walkX = (x - startX) * 1.2;
                const walkY = (y - startY) * 1.2;
                el.scrollLeft = scrollLeft - walkX;
                el.scrollTop = scrollTop - walkY;
            });
        }

        // =====================================================
        //  CARGA DINÁMICA DE RECURSOS
        // =====================================================
        async function fetchResources() {
            try {
                const res = await fetch('/api/recursos');
                if (!res.ok) throw new Error('Sin servidor');
                const data = await res.json();
                RESOURCES.shields = data.shields || [];
                RESOURCES.socials = data.socials || [];
            } catch (e) {
                console.warn('No se pudo conectar a /api/recursos — usando recursos vacíos.');
            }
        }

        // =====================================================
        //  TEMA CLARO / OSCURO
        // =====================================================
        function toggleTheme() {
            const isLight = document.body.classList.toggle('light-mode');
            localStorage.setItem('fgc_theme', isLight ? 'light' : 'dark');
        }

        // =====================================================
        //  INICIALIZACIÓN
        // =====================================================
        window.onload = () => {
            const stored = localStorage.getItem('fgc_theme');
            if (stored === 'light') {
                document.body.classList.add('light-mode');
            }
            fetchResources().then(() => {
                loadSavedData();
                applyDefaultsUI();
            });
            initDragScroll();
        };
    