// Administrador de correlativos: numeración de facturas incremental de 1 en 1, independiente por tipo de documento y por año
// (colección "invoice_sequences", un documento por tipo + año). Formato del número: PREFIJO-AAAA + 6 dígitos.
const { GLOBAL_CATALOGS_DB } = require('./db-config');

const NUMBER_DIGITS = 6;
const MAX_NUMBER = 10 ** NUMBER_DIGITS - 1;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = function registerInvoiceSequences(app, mongoose, Invoice, HttpError) {
    const schema = new mongoose.Schema({
        _id: String,
        documentTypeId: { type: mongoose.Schema.Types.ObjectId, required: true },
        year: { type: Number, required: true },
        prefix: { type: String, required: true, trim: true },
        lastNumber: { type: Number, default: 0, min: 0, max: MAX_NUMBER },
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date
    });
    schema.index({ prefix: 1, year: 1 }, { unique: true });
    const Sequence = mongoose.model('InvoiceSequence', schema, 'invoice_sequences');

    const DocumentType = () => mongoose.connection.useDb(GLOBAL_CATALOGS_DB, { useCache: true }).model('DocumentType');
    const keyOf = (typeId, year) => `${typeId}:${year}`;
    const formatNumber = (prefix, year, n) => `${prefix}-${year}${String(n).padStart(NUMBER_DIGITS, '0')}`;
    const numberPattern = (prefix, year) => new RegExp(`^${escapeRegex(prefix)}-${year}\\d{${NUMBER_DIGITS}}$`);

    // Último correlativo realmente emitido en facturas con ese prefijo y año
    const highestUsed = async (prefix, year) => {
        const last = await Invoice.findOne({ documentNumber: numberPattern(prefix, year) }).sort({ documentNumber: -1 }).select('documentNumber');
        return last ? Number(last.documentNumber.slice(-NUMBER_DIGITS)) : 0;
    };

    // Asigna de forma atómica el siguiente correlativo del tipo de documento según el año de la factura; el año nuevo se abre en 1
    const nextNumber = async (date, documentTypeId) => {
        const type = await DocumentType().findById(documentTypeId);
        if (!type) throw new HttpError(400, 'El tipo de documento no existe en el Administrador de Documentos');
        const year = date.getUTCFullYear();
        const now = new Date();
        let seq;
        try {
            seq = await Sequence.findOneAndUpdate(
                { _id: keyOf(type._id, year), active: { $ne: false } },
                {
                    $inc: { lastNumber: 1 },
                    $setOnInsert: { documentTypeId: type._id, year, prefix: type.documentCode, active: true, createdAt: now },
                    $set: { updatedAt: now }
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            if (error.code === 11000) {
                const existing = await Sequence.findById(keyOf(type._id, year));
                if (existing && existing.active === false) throw new HttpError(409, `El correlativo de ${type.description} del año ${year} está inactivo`);
                throw new HttpError(409, `El prefijo ${type.documentCode} ya está en uso en otro correlativo del año ${year}`);
            }
            throw error;
        }
        if (seq.lastNumber > MAX_NUMBER) {
            await Sequence.updateOne({ _id: seq._id }, { $set: { lastNumber: MAX_NUMBER } });
            throw new HttpError(409, `Se agotó el correlativo de ${type.description} del año ${year}`);
        }
        return formatNumber(seq.prefix, year, seq.lastNumber);
    };

    const typesMap = async (ids) => {
        const rows = await DocumentType().find({ _id: { $in: ids } });
        return new Map(rows.map((t) => [String(t._id), t]));
    };

    const toDto = async (doc, types) => ({
        id: doc._id,
        documentTypeId: doc.documentTypeId,
        documentType: types.get(String(doc.documentTypeId))?.description ?? '(tipo eliminado)',
        year: doc.year,
        prefix: doc.prefix,
        lastNumber: doc.lastNumber,
        nextNumber: formatNumber(doc.prefix, doc.year, doc.lastNumber + 1),
        active: doc.active,
        issued: await Invoice.countDocuments({ documentNumber: numberPattern(doc.prefix, doc.year) })
    });

    const fail = (res, error, fallback) => {
        if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
        if (error.code === 11000) return res.status(409).json({ error: 'Ya existe un correlativo para ese tipo de documento y año, o el prefijo ya está en uso' });
        if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ error: 'Datos inválidos' });
        console.error(fallback, error);
        return res.status(500).json({ error: fallback });
    };

    const parseLastNumber = (value) => {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) throw new HttpError(400, `El último correlativo debe ser un entero entre 0 y ${MAX_NUMBER}`);
        return n;
    };

    app.get('/api/invoice-sequences', async (req, res) => {
        try {
            const rows = await Sequence.find().sort({ year: -1, prefix: 1 });
            const types = await typesMap(rows.map((r) => r.documentTypeId));
            res.json(await Promise.all(rows.map((r) => toDto(r, types))));
        } catch (error) {
            fail(res, error, 'Error al obtener los correlativos');
        }
    });

    app.post('/api/invoice-sequences', async (req, res) => {
        try {
            const year = Number(req.body.year);
            if (!Number.isInteger(year) || year < 2000 || year > 2999) throw new HttpError(400, 'Año inválido');
            if (!mongoose.isValidObjectId(req.body.documentTypeId)) throw new HttpError(400, 'Debe seleccionar el tipo de documento');
            const type = await DocumentType().findById(req.body.documentTypeId);
            if (!type) throw new HttpError(400, 'El tipo de documento no existe');
            const prefix = String(req.body.prefix || type.documentCode).trim();
            if (!prefix) throw new HttpError(400, 'El prefijo es obligatorio');
            const lastNumber = parseLastNumber(req.body.lastNumber ?? 0);
            const used = await highestUsed(prefix, year);
            if (lastNumber < used) throw new HttpError(400, `Ya existen facturas hasta el correlativo ${used} con el prefijo ${prefix} en ${year}`);
            const saved = await new Sequence({
                _id: keyOf(type._id, year), documentTypeId: type._id, year, prefix, lastNumber, active: req.body.active !== false
            }).save();
            res.status(201).json(await toDto(saved, new Map([[String(type._id), type]])));
        } catch (error) {
            fail(res, error, 'Error al crear el correlativo');
        }
    });

    // Solo se permite ajustar el último correlativo hacia arriba de lo ya emitido, para no duplicar números
    app.put('/api/invoice-sequences/:id', async (req, res) => {
        try {
            const current = await Sequence.findById(req.params.id);
            if (!current) return res.status(404).json({ error: 'Correlativo no encontrado' });
            const update = { updatedAt: new Date() };
            if (req.body.lastNumber !== undefined) {
                update.lastNumber = parseLastNumber(req.body.lastNumber);
                const used = await highestUsed(current.prefix, current.year);
                if (update.lastNumber < used) throw new HttpError(400, `Ya existen facturas hasta el correlativo ${used} con el prefijo ${current.prefix} en ${current.year}`);
            }
            if (req.body.active !== undefined) update.active = !!req.body.active;
            const saved = await Sequence.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
            res.json(await toDto(saved, await typesMap([saved.documentTypeId])));
        } catch (error) {
            fail(res, error, 'Error al actualizar el correlativo');
        }
    });

    app.delete('/api/invoice-sequences/:id', async (req, res) => {
        try {
            const current = await Sequence.findById(req.params.id);
            if (!current) return res.status(404).json({ error: 'Correlativo no encontrado' });
            if (await Invoice.exists({ documentNumber: numberPattern(current.prefix, current.year) })) {
                throw new HttpError(409, 'No se puede eliminar: ya hay facturas con este correlativo. Desactívelo en su lugar');
            }
            await Sequence.findByIdAndDelete(req.params.id);
            res.json({ success: true, message: 'Correlativo eliminado correctamente' });
        } catch (error) {
            fail(res, error, 'Error al eliminar el correlativo');
        }
    });

    // Elimina los correlativos anuales generales de la versión anterior (sin tipo de documento) y crea los índices
    const init = async () => {
        await Sequence.collection.deleteMany({ documentTypeId: { $exists: false } });
        await Sequence.init();
    };

    return { nextNumber, init };
};
