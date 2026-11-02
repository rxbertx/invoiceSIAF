// Solución para ReferenceError: crypto is not defined en versiones antiguas de Node.js
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = require('crypto');
}

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Permite que Angular se conecte

// 1. Dile a Express que confíe en los proxies (Como el túnel de Cloudflare)
app.set('trust proxy', true);

// Conexión a MongoDB Atlas usando variable de entorno
const { MONGODB_URI, MAIN_DB } = require('./db-config');
mongoose.connect(MONGODB_URI, {
    dbName: MAIN_DB,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log(`Conectado a MongoDB - Base de datos: ${MAIN_DB}`);
    // Crea la colección "clients" si aún no existe
    try {
        await Client.createCollection();
    } catch (err) {
        if (err.codeName !== 'NamespaceExists') console.error('Error al crear la colección clients', err);
    }
    try {
        await initInvoices();
    } catch (err) {
        console.error('Error al inicializar facturación', err);
    }
    try {
        await initDocumentTypes();
    } catch (err) {
        console.error('Error al inicializar tipos de documento', err);
    }
    try {
        await seedGlobalCatalogs();
    } catch (err) {
        console.error('Error al cargar los catálogos globales', err);
    }
})
  .catch(err => console.error('Error de conexión', err));

// Definición de un modelo sencillo
const Evento = mongoose.model('Evento', {
    titulo: String,
    fecha: Date
});

// Modelo de Usuario ajustado a la colección "users"
const User = mongoose.model('User', {
    name: String,
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: String,
    image: String
}, 'users');

// Modelo para Boards Kanban
const BoardKanban = mongoose.model('BoardKanban', {
    title: String,
    description: String,
    status: String,
    createdAt: Date,
    dueDate: Date,
    // Usuario que creó el tablero
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: null },
    // Coordinador asignado al proyecto
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    coordinatorName: { type: String, default: null }
}, 'boards_kanban');

// Modelo para Kanban Lists
const KanbanList = mongoose.model('KanbanList', {
    title: String,
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoardKanban' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cards: [],
    order: { type: Number, default: 0 },
    createdAt: Date,
    updatedAt: Date
}, 'kanbanlists');

// Modelo para configuración SMTP (documento único)
const SmtpConfig = mongoose.model('SmtpConfig', {
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 465 },
    secure: { type: Boolean, default: true },
    user: String,
    pass: String,
    fromName: String,
    fromEmail: String,
    enabled: { type: Boolean, default: false },
    // Días de anticipación con los que se avisa el vencimiento de una tarea
    notifyDaysBefore: { type: Number, default: 3 },
    updatedAt: Date
}, 'smtp_config');

// Modelo para permisos de roles
const RolPermission = mongoose.model('RolPermission', {
    rol: { type: String, required: true, unique: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: Date
}, 'rol_permissions');

// Modelo para el catálogo de Clientes (colección "clients")
const Client = mongoose.model('Client', {
    name: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    personType: { type: String, required: true },
    country: { type: String, required: true },
    department: { type: String, required: true },
    municipality: { type: String, default: 'Otro (Para extranjeros)' },
    // El código de municipio se repite en el catálogo; el vínculo real es el ID
    municipalityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    settlementFormat: { type: String, default: '' },
    documentType: { type: String, required: true },
    documentNumber: { type: String, required: true, trim: true },
    establishmentType: { type: String, required: true },
    economicActivity: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    isForeign: { type: Boolean, default: false },
    isLargeTaxpayer: { type: Boolean, default: false },
    paysIva: { type: Boolean, default: true },
    isTaxpayer: { type: Boolean, default: false },
    ivaRegistration: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
}, 'clients');

/////////////////////////////////// Configuración SMTP ///////////////////////////////////////////////
// La contraseña nunca se devuelve al cliente; solo un indicador de si ya está guardada
app.get('/api/smtp-config', async (req, res) => {
    try {
        const config = await SmtpConfig.findOne();
        if (!config) return res.json(null);
        const { pass, ...data } = config.toObject();
        res.json({ ...data, hasPassword: !!pass });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la configuración SMTP' });
    }
});

app.put('/api/smtp-config', async (req, res) => {
    try {
        const { host, port, secure, user, pass, fromName, fromEmail, enabled, notifyDaysBefore } = req.body;
        const update = { host, port, secure, user, fromName, fromEmail, enabled, updatedAt: new Date() };
        if (notifyDaysBefore !== undefined && notifyDaysBefore !== null) {
            update.notifyDaysBefore = Math.max(0, parseInt(notifyDaysBefore, 10) || 0);
        }
        // Si no envían contraseña se conserva la existente
        if (pass) update.pass = pass;

        const saved = await SmtpConfig.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true });
        const { pass: _, ...data } = saved.toObject();
        res.json({ success: true, data: { ...data, hasPassword: !!saved.pass } });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar la configuración SMTP' });
    }
});

// Envía un correo de prueba con la configuración guardada
app.post('/api/smtp-config/test', async (req, res) => {
    try {
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: 'Falta el destinatario de prueba' });

        const config = await SmtpConfig.findOne();
        if (!config || !config.user || !config.pass) {
            return res.status(400).json({ error: 'La configuración SMTP está incompleta. Guarda usuario y contraseña primero.' });
        }

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.user, pass: config.pass }
        });

        await transporter.sendMail({
            from: `"${config.fromName || 'Tablero'}" <${config.fromEmail || config.user}>`,
            to,
            subject: 'Correo de prueba - Configuración SMTP',
            html: '<p>✅ La configuración SMTP del tablero funciona correctamente.</p>'
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error en correo de prueba:', error.message);
        res.status(500).json({ error: 'No se pudo enviar: ' + error.message });
    }
});

/////////////////////////////////// Notificaciones de vencimiento ///////////////////////////////////////////////

// Revisa las tareas próximas a vencer y envía un correo a cada responsable.
// Cada tarjeta se notifica una sola vez por combinación fecha/configuración
// (si cambia el dueDate o los días de anticipación, se vuelve a avisar).
async function checkDueDates() {
    try {
        const config = await SmtpConfig.findOne();
        if (!config || !config.enabled || !config.user || !config.pass) return;

        const daysBefore = config.notifyDaysBefore ?? 3;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const msPorDia = 24 * 60 * 60 * 1000;

        const [lists, users, boards] = await Promise.all([
            KanbanList.find(),
            User.find(),
            BoardKanban.find()
        ]);

        // Mapas para resolver correo del responsable y nombre del proyecto
        const emailById = new Map(users.map(u => [String(u._id), u.email]));
        const emailByName = new Map(users.map(u => [u.name, u.email]));
        const boardName = new Map(boards.map(b => [String(b._id), b.title]));

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.user, pass: config.pass }
        });

        // Detalle de avisos enviados en esta corrida, para el resumen a administradores
        const enviados = [];

        for (const list of lists) {
            let modified = false;

            for (const card of (list.cards || [])) {
                if (card.completed || !card.dueDate) continue;

                const due = new Date(card.dueDate); due.setHours(0, 0, 0, 0);
                const diasRestantes = Math.round((due - today) / msPorDia);
                if (diasRestantes < 0 || diasRestantes > daysBefore) continue;

                const notifyKey = `${new Date(card.dueDate).toISOString()}|${daysBefore}`;
                if (card.dueNotifiedKey === notifyKey) continue;

                const destinatarios = [...new Set((card.assignees || [])
                    .map(a => emailById.get(String(a._id)) || emailByName.get(a.name))
                    .filter(Boolean))];
                if (!destinatarios.length) continue;

                const proyecto = boardName.get(String(list.boardId)) || 'Proyecto';
                const vencimiento = due.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
                const cuando = diasRestantes === 0 ? 'vence HOY' : (diasRestantes === 1 ? 'vence MAÑANA' : `vence en ${diasRestantes} días`);

                try {
                    await transporter.sendMail({
                        from: `"${config.fromName || 'Tablero'}" <${config.fromEmail || config.user}>`,
                        to: destinatarios.join(', '),
                        subject: `⏰ La tarea "${card.title || 'Sin título'}" ${cuando}`,
                        html: `
                            <div style="font-family:Arial,sans-serif;max-width:520px">
                                <h2 style="color:#6366f1;margin-bottom:4px">Recordatorio de vencimiento</h2>
                                <p>La siguiente tarea <b>${cuando}</b>:</p>
                                <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0">
                                    <p style="margin:0 0 6px"><b>Tarea:</b> ${card.title || 'Sin título'}</p>
                                    <p style="margin:0 0 6px"><b>Proyecto:</b> ${proyecto}</p>
                                    <p style="margin:0 0 6px"><b>Estatus:</b> ${list.title}</p>
                                    <p style="margin:0"><b>Fecha de vencimiento:</b> ${vencimiento}</p>
                                </div>
                                <p style="color:#6b7280;font-size:12px">Este es un mensaje automático del tablero de proyectos.</p>
                            </div>`
                    });

                    card.dueNotifiedKey = notifyKey;
                    modified = true;
                    enviados.push({
                        proyecto,
                        tarea: card.title || 'Sin título',
                        estatus: list.title,
                        vencimiento,
                        cuando,
                        responsables: (card.assignees || []).map(a => a.name).filter(Boolean),
                        destinatarios
                    });
                    console.log(`📧 Aviso de vencimiento enviado: "${card.title}" -> ${destinatarios.join(', ')}`);
                } catch (mailErr) {
                    console.error(`Error enviando aviso de "${card.title}":`, mailErr.message);
                }
            }

            if (modified) {
                list.markModified('cards');
                await list.save();
            }
        }

        // Resumen para administradores de lo que se notificó en esta corrida
        if (enviados.length) {
            const adminEmails = [...new Set(users
                .filter(u => u.role === 'ADMIN' && u.email)
                .map(u => u.email))];

            if (adminEmails.length) {
                // Agrupamos el detalle por proyecto
                const porProyecto = new Map();
                for (const e of enviados) {
                    if (!porProyecto.has(e.proyecto)) porProyecto.set(e.proyecto, []);
                    porProyecto.get(e.proyecto).push(e);
                }

                let secciones = '';
                for (const [proyecto, avisos] of porProyecto) {
                    const filas = avisos.map(a => `
                        <tr>
                            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${a.tarea}</td>
                            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${a.estatus}</td>
                            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${a.vencimiento}<br><span style="color:#f59e0b;font-size:12px">${a.cuando}</span></td>
                            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${a.responsables.join(', ') || '-'}<br><span style="color:#6b7280;font-size:12px">${a.destinatarios.join(', ')}</span></td>
                        </tr>`).join('');

                    secciones += `
                        <h3 style="color:#374151;margin:20px 0 8px">📁 ${proyecto} <span style="color:#6b7280;font-weight:normal;font-size:13px">(${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'})</span></h3>
                        <table style="width:100%;border-collapse:collapse;font-size:14px">
                            <tr style="background:#f3f4f6;text-align:left">
                                <th style="padding:8px">Tarea</th>
                                <th style="padding:8px">Estatus</th>
                                <th style="padding:8px">Vence</th>
                                <th style="padding:8px">Notificado a</th>
                            </tr>
                            ${filas}
                        </table>`;
                }

                try {
                    await transporter.sendMail({
                        from: `"${config.fromName || 'Tablero'}" <${config.fromEmail || config.user}>`,
                        to: adminEmails.join(', '),
                        subject: `📋 Resumen de recordatorios enviados (${enviados.length})`,
                        html: `
                            <div style="font-family:Arial,sans-serif;max-width:680px">
                                <h2 style="color:#6366f1;margin-bottom:4px">Resumen de recordatorios de vencimiento</h2>
                                <p>Se enviaron <b>${enviados.length}</b> ${enviados.length === 1 ? 'aviso' : 'avisos'} de vencimiento:</p>
                                ${secciones}
                                <p style="color:#6b7280;font-size:12px;margin-top:20px">Este es un mensaje automático del tablero de proyectos.</p>
                            </div>`
                    });
                    console.log(`📋 Resumen enviado a administradores: ${adminEmails.join(', ')}`);
                } catch (mailErr) {
                    console.error('Error enviando resumen a administradores:', mailErr.message);
                }
            }
        }
    } catch (error) {
        console.error('Error en checkDueDates:', error.message);
    }
}

// Se ejecuta al arrancar (tras conectar a MongoDB) y luego cada hora
setTimeout(checkDueDates, 15 * 1000);
setInterval(checkDueDates, 60 * 60 * 1000);

// Disparo manual para probar sin esperar el intervalo
app.post('/api/smtp-config/run-due-check', async (req, res) => {
    await checkDueDates();
    res.json({ success: true });
});

/////////////////////////////////// CRUD para Rol Permissions ///////////////////////////////////////////////
app.get('/api/rol-permissions', async (req, res) => {
    try {
        const perms = await RolPermission.find();
        res.json(perms);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

app.put('/api/rol-permissions', async (req, res) => {
    try {
        const { rol, permissions } = req.body;
        const updated = await RolPermission.findOneAndUpdate(
            { rol },
            { $set: { permissions, updatedAt: new Date() } },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar permisos' });
    }
});

/////////////////////////////////// CRUD para Boards Kanban///////////////////////////////////////////////
// Obtener todos los tableros
app.get('/api/boards-kanban', async (req, res) => {
    try {
        const boards = await BoardKanban.find();
        // Transformamos _id a id para que el frontend lo reconozca correctamente
        const transformedBoards = boards.map(board => ({
            ...board.toObject(),
            id: board._id
        }));
        res.json(transformedBoards);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener tableros" });
    }
});

// Crear un nuevo tablero
app.post('/api/boards-kanban', async (req, res) => {
    try {
        const { title, description, status, userId, createdByName, dueDate, coordinatorId, coordinatorName } = req.body;
        const newBoard = new BoardKanban({
            title,
            description,
            status: status || 'ACTIVE',
            userId: userId || null,
            createdByName: createdByName || null,
            createdAt: new Date(),
            dueDate: dueDate || null,
            coordinatorId: coordinatorId || null,
            coordinatorName: coordinatorName || null
        });
        const savedBoard = await newBoard.save();

        // Creamos las listas por defecto asociadas al nuevo tablero
        const defaultLists = [
            {
                title: 'Pendiente',
                boardId: savedBoard._id,
                userId: userId || null,
                cards: [],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'En Proceso',
                boardId: savedBoard._id,
                userId: userId || null,
                cards: [],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                title: 'Completadas',
                boardId: savedBoard._id,
                userId: userId || null,
                cards: [],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        await KanbanList.insertMany(defaultLists);

        res.status(201).json({ ...savedBoard.toObject(), id: savedBoard._id });
    } catch (error) {
        console.error("Error al crear tablero y listas:", error);
        res.status(500).json({ error: "Error al crear el tablero" });
    }
});

// Actualizar un tablero
app.put('/api/boards-kanban/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBoard = await BoardKanban.findByIdAndUpdate(id, req.body, { new: true });
        if (updatedBoard) {
            res.json({ ...updatedBoard.toObject(), id: updatedBoard._id });
        } else {
            res.status(404).json({ error: "Tablero no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el tablero" });
    }
});

// Eliminar un tablero
app.delete('/api/boards-kanban/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Borrado en cascada: eliminamos todas las listas que pertenecen a este boardId
        await KanbanList.deleteMany({ boardId: id });
        
        // 2. Eliminamos el tablero principal
        await BoardKanban.findByIdAndDelete(id);
        res.json({ success: true, message: "Tablero y sus listas asociados eliminados correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el tablero" });
    }
});


/////////////////////////////////// CRUD para Kanban Lists ///////////////////////////////////////////////
// Obtener listas por Board ID
app.get('/api/kanban-lists/:boardId', async (req, res) => {
    try {
        const { boardId } = req.params;
        // Buscamos las listas asociadas al boardId proporcionado
        const lists = await KanbanList.find({ boardId: boardId }).sort({ order: 1 });
        
        // Mapeamos para que el frontend reciba listId (que es el _id de Mongo)
        const transformedLists = lists.map(list => ({
            ...list.toObject(),
            listId: list._id
        }));
        
        res.json({ data: transformedLists });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener las listas del tablero" });
    }
});

// Reordenar listas de un tablero
app.put('/api/boards-kanban/:boardId/reorder-lists', async (req, res) => {
    try {
        const { listIds } = req.body;
        // Creamos una operación masiva para actualizar el orden de cada lista
        const bulkOps = listIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { $set: { order: index } }
            }
        }));
        await KanbanList.bulkWrite(bulkOps);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error al reordenar listas" });
    }
});

// Crear una nueva lista
app.post('/api/kanban-lists', async (req, res) => {
    try {
        const { title, boardId, userId } = req.body;
        const newList = new KanbanList({
            title: title || 'Nueva Lista',
            boardId,
            userId: userId || null,
            cards: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const savedList = await newList.save();
        res.status(201).json({ 
            ...savedList.toObject(), 
            listId: savedList._id 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al crear la lista" });
    }
});

// Eliminar una lista
app.delete('/api/kanban-lists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await KanbanList.findByIdAndDelete(id);
        res.json({ success: true, message: "Lista eliminada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la lista" });
    }
});

// Actualizar una lista (título)
app.put('/api/kanban-lists/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const updated = await KanbanList.findByIdAndUpdate(listId, { $set: req.body }, { new: true });
        if (!updated) return res.status(404).json({ error: "Lista no encontrada" });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la lista" });
    }
});

// Agregar una tarjeta a una lista
app.post('/api/kanban-lists/:listId/cards', async (req, res) => {
    try {
        const { listId } = req.params;
        const newCard = {
            ...req.body,
            id: new mongoose.Types.ObjectId().toString() // Generamos un ID único para la tarjeta
        };

        const updatedList = await KanbanList.findByIdAndUpdate(
            listId,
            { $push: { cards: newCard } },
            { new: true }
        );

        if (!updatedList) return res.status(404).json({ error: "Lista no encontrada" });
        res.status(201).json(newCard);
    } catch (error) {
        res.status(500).json({ error: "Error al crear la tarjeta" });
    }
});

// Eliminar una tarjeta de una lista
app.delete('/api/kanban-lists/:listId/cards/:cardId', async (req, res) => {
    try {
        const { listId, cardId } = req.params;
        await KanbanList.findByIdAndUpdate(listId, { $pull: { cards: { id: cardId } } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar la tarjeta" });
    }
});

// Actualizar una tarjeta de una lista
app.put('/api/kanban-lists/:listId/cards/:cardId', async (req, res) => {
    try {
        const { listId, cardId } = req.params;
        const updatedCardData = req.body;

        const updatedList = await KanbanList.findOneAndUpdate(
            { _id: listId, "cards.id": cardId },
            { $set: { "cards.$": { ...updatedCardData, id: cardId } } },
            { new: true }
        );

        if (!updatedList) return res.status(404).json({ error: "Lista o tarjeta no encontrada" });
        res.json(updatedCardData);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la tarjeta" });
    }
});

// Fecha de cierre normalizada al inicio del día local, misma convención que dueDate
// (evita que un cierre por la noche se guarde con la fecha del día siguiente en UTC)
function localDayISO(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

// Mover una tarjeta entre listas
app.post('/api/kanban-lists/move-card', async (req, res) => {
    try {
        const { card, sourceListId, targetListId } = req.body;

        // Verificamos si la lista destino es "Completadas" para estampar la fecha
        const targetList = await KanbanList.findById(targetListId);
        const isCompletedList = targetList && targetList.title &&
            targetList.title.toLowerCase() === 'completadas';

        let updatedCard = { ...card };
        if (isCompletedList) {
            updatedCard.completed = true;
            updatedCard.completedAt = localDayISO();
        } else {
            // Si sale de completadas, limpiamos la fecha de cierre
            updatedCard.completed = false;
            updatedCard.completedAt = null;
        }

        // 1. Eliminamos la tarjeta de la lista de origen
        await KanbanList.findByIdAndUpdate(sourceListId, {
            $pull: { cards: { id: card.id } }
        });

        // 2. La agregamos a la lista de destino con los campos actualizados
        await KanbanList.findByIdAndUpdate(targetListId, {
            $push: { cards: updatedCard }
        });

        res.json({ success: true, card: updatedCard });
    } catch (error) {
        console.error("Error al mover tarjeta:", error);
        res.status(500).json({ error: "Error al mover la tarjeta" });
    }
});

/////////////////////////////////// CRUD para Usuarios ///////////////////////////////////////////////
// Obtener todos los usuarios
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        const transformedUsers = users.map(user => {
            const { password, ...userData } = user.toObject();
            return { ...userData, id: user._id };
        });
        res.json(transformedUsers);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

// Crear un nuevo usuario
app.post('/api/users', async (req, res) => {
    try {
        const newUser = new User(req.body);
        const savedUser = await newUser.save();
        const { password, ...userData } = savedUser.toObject();
        res.status(201).json({ ...userData, id: savedUser._id });
    } catch (error) {
        res.status(500).json({ error: "Error al crear usuario" });
    }
});

// Actualizar un usuario
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
        if (updatedUser) {
            const { password, ...userData } = updatedUser.toObject();
            res.json({ ...userData, id: updatedUser._id });
        } else {
            res.status(404).json({ error: "Usuario no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el usuario" });
    }
});

// Eliminar un usuario
app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Usuario eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el usuario" });
    }
});

/////////////////////////////////// CRUD para Clientes ///////////////////////////////////////////////
const CLIENT_FIELDS = [
    'name', 'businessName', 'address', 'personType', 'country', 'department', 'municipality', 'municipalityId',
    'email', 'phone', 'documentType', 'documentNumber', 'establishmentType',
    'economicActivity', 'isActive', 'isForeign', 'isLargeTaxpayer', 'paysIva', 'isTaxpayer', 'ivaRegistration'
];

// Solo se aceptan los campos del catálogo (evita sobrescribir _id/createdAt desde el cliente)
const pickClientData = (body) => {
    const data = {};
    for (const field of CLIENT_FIELDS) {
        if (body[field] !== undefined) data[field] = body[field];
    }
    // El registro de IVA solo aplica a contribuyentes
    if (data.isTaxpayer === false) data.ivaRegistration = '';
    return data;
};

const taxpayerWithoutRegistration = (data) => data.isTaxpayer === true && !String(data.ivaRegistration ?? '').trim();

const toClientDto = (doc) => {
    const { _id, __v, ...data } = doc.toObject();
    return { ...data, id: _id };
};

app.get('/api/clients', async (req, res) => {
    try {
        const clients = await Client.find().sort({ name: 1 });
        res.json(clients.map(toClientDto));
    } catch (error) {
        res.status(500).json({ error: "Error al obtener clientes" });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        const data = pickClientData(req.body);
        if (taxpayerWithoutRegistration(data)) return res.status(400).json({ error: "El número de registro de IVA es obligatorio para contribuyentes" });
        const saved = await new Client(data).save();
        res.status(201).json(toClientDto(saved));
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: "Faltan campos obligatorios del cliente" });
        }
        res.status(500).json({ error: "Error al crear el cliente" });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const data = pickClientData(req.body);
        if (taxpayerWithoutRegistration(data)) return res.status(400).json({ error: "El número de registro de IVA es obligatorio para contribuyentes" });
        const updated = await Client.findByIdAndUpdate(
            req.params.id,
            { ...data, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: "Cliente no encontrado" });
        res.json(toClientDto(updated));
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ error: "Datos del cliente inválidos" });
        }
        res.status(500).json({ error: "Error al actualizar el cliente" });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const deleted = await Client.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Cliente no encontrado" });
        res.json({ success: true, message: "Cliente eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el cliente" });
    }
});

/////////////////////////////////// Catálogos Facturación Electrónica (BD globalCatalogs) /////////////
const seedGlobalCatalogs = require('./global-catalogs')(app, mongoose);

/////////////////////////////////// Facturación ///////////////////////////////////////////////////////
const initInvoices = require('./invoices')(app, mongoose);

/////////////////////////////////// Administrador de documentos ///////////////////////////////////////
const initDocumentTypes = require('./document-types')(app, mongoose);

/////////////////////////////////// CRUD para LOGIN///////////////////////////////////////////////

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Intentando login para: ${email}`);
        
        const user = await User.findOne({ email, password });

        if (user) {
            console.log("✅ Usuario encontrado en MongoDB");
            // Enviamos los datos del usuario excepto el password
            const { password: _, ...userData } = user.toObject();
            res.json({ success: true, user: userData });
        } else {
            console.log("❌ Credenciales no coinciden en la base de datos");
            res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

//2. Asegúrate de que el servidor escuche en la IP '0.0.0.0'
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node Express server listening on http://0.0.0.0:${PORT}`);
});
