// Aplicación de documentos: las notas de débito/crédito se aplican contra créditos fiscales.
// Cada aplicación es TEMPORAL mientras la nota está en borrador y pasa a REAL al validar la nota.
const CREDITO_FISCAL_DTE = '03';
const DEBIT_NOTE_DTE = '06';
const NOTE_DTES = ['05', '06'];
const ACTIVE = ['TEMPORAL', 'REAL'];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const monthStart = (y, m) => new Date(Date.UTC(y, m - 1, 1));
// La nota de débito incrementa el saldo del crédito fiscal y la de crédito lo reduce
const effectOf = (dteType) => (dteType === DEBIT_NOTE_DTE ? 'INCREASE' : 'DECREASE');

module.exports = function registerInvoiceApplications(app, mongoose, Invoice, HttpError, handleError, rebuildLines) {
    const { ObjectId } = mongoose.Types;

    const Application = mongoose.model('InvoiceApplication', new mongoose.Schema({
        noteId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        noteNumber: { type: String, default: '' },
        noteDocumentType: { type: String, default: '' },
        noteDate: { type: Date, required: true },
        effect: { type: String, enum: ['INCREASE', 'DECREASE'], required: true },
        unit: { type: String, default: '' },
        unitName: { type: String, default: '' },
        targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        targetNumber: { type: String, default: '' },
        targetDocumentType: { type: String, default: '' },
        targetDate: { type: Date, required: true },
        targetBillToName: { type: String, default: '' },
        baseValue: { type: Number, required: true },
        mode: { type: String, enum: ['PERCENT', 'AMOUNT'], required: true },
        percent: { type: Number, default: null },
        amount: { type: Number, required: true, min: 0.01 },
        status: { type: String, enum: ['TEMPORAL', 'REAL', 'ANULADA'], default: 'TEMPORAL', index: true },
        createdAt: { type: Date, default: Date.now },
        appliedAt: { type: Date, default: null },
        updatedAt: Date
    }), 'invoice_applications');

    const toDto = (doc) => {
        const { _id, __v, ...data } = doc.toObject();
        return { ...data, id: _id };
    };

    const parseMonth = (value) => {
        const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
        if (!match || +match[2] < 1 || +match[2] > 12) return null;
        return { y: +match[1], m: +match[2] };
    };

    const toObjectId = (value, message) => {
        if (!mongoose.isValidObjectId(value)) throw new HttpError(400, message);
        return new ObjectId(String(value));
    };

    // Efecto neto (real y temporal) sobre cada crédito fiscal: suma de notas de débito menos notas de crédito
    const appliedByTarget = async (targetIds, excludeNoteId) => {
        const match = { targetId: { $in: targetIds }, status: { $in: ACTIVE } };
        if (excludeNoteId) match.noteId = { $ne: excludeNoteId };
        const rows = await Application.aggregate([
            { $match: match },
            { $group: { _id: { target: '$targetId', status: '$status', effect: '$effect' }, amount: { $sum: '$amount' } } }
        ]);
        const result = new Map();
        for (const r of rows) {
            const key = String(r._id.target);
            const entry = result.get(key) || { real: 0, temporal: 0 };
            const signed = r._id.effect === 'INCREASE' ? r.amount : -r.amount;
            const field = r._id.status === 'REAL' ? 'real' : 'temporal';
            entry[field] = round2(entry[field] + signed);
            result.set(key, entry);
        }
        return result;
    };

    const loadNote = async (id) => {
        const note = await Invoice.findById(id).select('-lines');
        if (!note) throw new HttpError(404, 'Factura no encontrada');
        if (!NOTE_DTES.includes(note.dteType)) throw new HttpError(409, 'Solo las notas de débito y de crédito aplican documentos');
        return note;
    };

    // Créditos fiscales disponibles para aplicar. scope: current (mes de la nota) | all | period (from/to = YYYY-MM)
    app.get('/api/invoices/:id/applicable', async (req, res) => {
        try {
            const note = await loadNote(req.params.id);
            const filter = { dteType: CREDITO_FISCAL_DTE, status: { $ne: 'ANULADA' } };
            if (req.query.scope !== 'all') {
                let from;
                let to;
                if (req.query.scope === 'period') {
                    from = parseMonth(req.query.from);
                    to = parseMonth(req.query.to) || from;
                    if (!from || !to) throw new HttpError(400, 'Indique el período en formato válido');
                } else {
                    const d = note.documentDate;
                    from = to = { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
                }
                filter.documentDate = { $gte: monthStart(from.y, from.m), $lt: monthStart(to.y, to.m + 1) };
            }
            const targets = await Invoice.find(filter).select('-lines').sort({ documentDate: -1, documentNumber: -1 });
            const applied = await appliedByTarget(targets.map((t) => t._id));
            const mine = await Application.find({ noteId: note._id, status: { $in: ACTIVE } });
            const mineByTarget = new Map(mine.map((a) => [String(a.targetId), a]));
            const decrease = effectOf(note.dteType) === 'DECREASE';

            res.json(targets.map((t) => {
                const sums = applied.get(String(t._id)) || { real: 0, temporal: 0 };
                const own = mineByTarget.get(String(t._id));
                const balance = round2(t.totals.total + sums.real + sums.temporal);
                return {
                    id: t._id,
                    documentNumber: t.documentNumber,
                    documentDate: t.documentDate,
                    documentType: t.documentType,
                    billToName: t.billToName,
                    status: t.status,
                    total: t.totals.total,
                    appliedReal: sums.real,
                    appliedTemporal: sums.temporal,
                    balance,
                    ownAmount: own ? own.amount : 0,
                    // Solo la nota de crédito está limitada por el saldo; la de débito lo incrementa
                    available: decrease ? round2(balance + (own ? own.amount : 0)) : null
                };
            }));
        } catch (error) {
            handleError(res, error, 'Error al obtener los documentos por aplicar');
        }
    });

    app.get('/api/invoices/:id/applications', async (req, res) => {
        try {
            const note = await loadNote(req.params.id);
            const rows = await Application.find({ noteId: note._id, status: { $ne: 'ANULADA' } }).sort({ targetDate: 1, targetNumber: 1 });
            res.json(rows.map(toDto));
        } catch (error) {
            handleError(res, error, 'Error al obtener las aplicaciones');
        }
    });

    // Reemplaza el conjunto de aplicaciones temporales de la nota por el recibido
    app.put('/api/invoices/:id/applications', async (req, res) => {
        try {
            const note = await loadNote(req.params.id);
            if (note.status !== 'BORRADOR') throw new HttpError(409, 'Solo se pueden modificar las aplicaciones de una nota en borrador');
            const items = Array.isArray(req.body?.applications) ? req.body.applications : [];
            const unit = String(req.body?.unit || '');
            const unitName = String(req.body?.unitName || '');
            if (items.length && !unit) throw new HttpError(400, 'No hay una unidad de medida por defecto para el detalle del ajuste');
            const effect = effectOf(note.dteType);
            const ids = items.map((i) => String(toObjectId(i.targetId, 'Documento a aplicar inválido')));
            if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Un documento no puede aplicarse dos veces en la misma nota');

            const targets = await Invoice.find({ _id: { $in: ids } }).select('-lines');
            const targetById = new Map(targets.map((t) => [String(t._id), t]));
            const others = await appliedByTarget(targets.map((t) => t._id), note._id);

            const docs = items.map((item, index) => {
                const target = targetById.get(ids[index]);
                if (!target) throw new HttpError(400, 'El documento a aplicar no existe');
                if (target.dteType !== CREDITO_FISCAL_DTE || target.status === 'ANULADA') {
                    throw new HttpError(409, `El documento ${target.documentNumber} no es un crédito fiscal vigente`);
                }
                const base = target.totals.total;
                const mode = item.mode === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
                let percent = null;
                let amount;
                if (mode === 'PERCENT') {
                    percent = Number(item.percent);
                    if (!(percent > 0) || (effect === 'DECREASE' && percent > 100)) {
                        throw new HttpError(400, effect === 'DECREASE' ? 'El porcentaje debe ser mayor a 0 y hasta 100' : 'El porcentaje debe ser mayor a 0');
                    }
                    amount = round2((base * percent) / 100);
                } else {
                    amount = round2(Number(item.amount));
                    if (!(amount > 0)) throw new HttpError(400, 'El monto a aplicar debe ser mayor a 0');
                    percent = round2((amount / base) * 100);
                }
                const used = others.get(ids[index]) || { real: 0, temporal: 0 };
                const available = round2(base + used.real + used.temporal);
                if (amount < 0.01) throw new HttpError(400, 'El monto a aplicar es demasiado pequeño');
                if (effect === 'DECREASE' && amount > available) {
                    throw new HttpError(409, `El monto a aplicar (${amount.toFixed(2)}) excede el saldo disponible (${available.toFixed(2)}) de ${target.documentNumber}`);
                }
                return {
                    noteId: note._id,
                    noteNumber: note.documentNumber,
                    noteDocumentType: note.documentType,
                    noteDate: note.documentDate,
                    effect,
                    unit,
                    unitName,
                    targetId: target._id,
                    targetNumber: target.documentNumber,
                    targetDocumentType: target.documentType,
                    targetDate: target.documentDate,
                    targetBillToName: target.billToName,
                    baseValue: base,
                    mode,
                    percent,
                    amount,
                    status: 'TEMPORAL'
                };
            });

            await Application.deleteMany({ noteId: note._id, status: 'TEMPORAL' });
            const saved = docs.length ? await Application.insertMany(docs) : [];
            await rebuildLines(note._id);
            res.json(saved.map(toDto));
        } catch (error) {
            handleError(res, error, 'Error al guardar las aplicaciones');
        }
    });

    // Consulta histórica. Filtros: from/to (YYYY-MM, sobre la fecha de la nota), status, noteId, targetId, noteNumber, targetNumber
    app.get('/api/invoice-applications', async (req, res) => {
        try {
            const filter = {};
            if (['TEMPORAL', 'REAL', 'ANULADA'].includes(req.query.status)) filter.status = req.query.status;
            if (req.query.noteId) filter.noteId = toObjectId(req.query.noteId, 'Nota inválida');
            if (req.query.targetId) filter.targetId = toObjectId(req.query.targetId, 'Documento inválido');
            if (req.query.noteNumber) filter.noteNumber = String(req.query.noteNumber);
            if (req.query.targetNumber) filter.targetNumber = String(req.query.targetNumber);
            const from = parseMonth(req.query.from);
            const to = parseMonth(req.query.to) || from;
            if (from && to) filter.noteDate = { $gte: monthStart(from.y, from.m), $lt: monthStart(to.y, to.m + 1) };
            const rows = await Application.find(filter).sort({ noteDate: -1, noteNumber: -1, targetNumber: 1 }).limit(1000);
            res.json(rows.map(toDto));
        } catch (error) {
            handleError(res, error, 'Error al consultar las aplicaciones');
        }
    });

    const hasActive = (field, id) => Application.exists({ [field]: id, status: { $in: ACTIVE } });

    return {
        init: () => Application.init(),
        // Al validar la nota las aplicaciones temporales pasan a reales; al desvalidar regresan a temporales
        promote: (noteId) => Application.updateMany({ noteId, status: 'TEMPORAL' }, { status: 'REAL', appliedAt: new Date(), updatedAt: new Date() }),
        demote: (noteId) => Application.updateMany({ noteId, status: 'REAL' }, { status: 'TEMPORAL', appliedAt: null, updatedAt: new Date() }),
        cancel: (noteId) => Application.updateMany({ noteId, status: 'TEMPORAL' }, { status: 'ANULADA', updatedAt: new Date() }),
        removeOf: (noteId) => Application.deleteMany({ noteId }),
        // Tras editar una nota: se actualiza la fecha; si dejó de ser nota o cambió su efecto (débito/crédito) se descartan sus aplicaciones temporales
        syncNote: async (note) => {
            if (!NOTE_DTES.includes(note.dteType)) return Application.deleteMany({ noteId: note._id, status: 'TEMPORAL' });
            await Application.deleteMany({ noteId: note._id, status: 'TEMPORAL', effect: { $ne: effectOf(note.dteType) } });
            return Application.updateMany({ noteId: note._id, status: 'TEMPORAL' }, { noteDate: note.documentDate, noteDocumentType: note.documentType, updatedAt: new Date() });
        },
        isNote: (dteType) => NOTE_DTES.includes(dteType),
        // Líneas del detalle de la nota generadas por sus aplicaciones vigentes (ajuste de saldo con IVA incluido)
        linesFor: async (noteId) => {
            const rows = await Application.find({ noteId, status: { $in: ACTIVE } }).sort({ targetDate: 1, targetNumber: 1 });
            return rows.map((a) => ({
                description: `Ajuste a documento ${a.targetNumber}`,
                unit: a.unit,
                unitName: a.unitName,
                quantity: 1,
                unitPrice: a.amount,
                exempt: false,
                valueWithIva: true,
                applicationTargetId: a.targetId
            }));
        },
        // Un crédito fiscal con aplicaciones vigentes no puede alterarse, anularse ni eliminarse
        assertTargetFree: async (invoice, action) => {
            if (invoice.dteType === CREDITO_FISCAL_DTE && (await hasActive('targetId', invoice._id))) {
                throw new HttpError(409, `No se puede ${action} un crédito fiscal con aplicaciones de notas`);
            }
        }
    };
};
