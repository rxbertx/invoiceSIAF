// Administrador de documentos: tipos de documento tributario (DTE) que el sistema puede generar (colección "document_types" en la base globalCatalogs)
const SEED = [
    { dteType: '03', controlNumber: 'DTE-03', serial: 'CF', version: 3, documentCode: 'FACFA', description: 'CREDITO FISCAL' },
    { dteType: '01', controlNumber: 'DTE-01', serial: 'FC', version: 1, documentCode: 'FACFC', description: 'FACTURA C. FINAL' },
    { dteType: '11', controlNumber: 'DTE-11', serial: 'FE', version: 1, documentCode: 'FACFE', description: 'FACT. EXPORTACION' },
    { dteType: '06', controlNumber: 'DTE-06', serial: 'DD', version: 3, documentCode: 'FACND', description: 'NOTA DE DEBITO' },
    { dteType: '05', controlNumber: 'DTE-05', serial: 'CC', version: 3, documentCode: 'FACNC', description: 'NOTA DE CREDITO' }
];

const { GLOBAL_CATALOGS_DB } = require('./db-config');

const TEXT_FIELDS = ['dteType', 'controlNumber', 'serial', 'documentCode', 'description'];

module.exports = (app, mongoose) => {
    // Base global compartida con los catálogos de facturación electrónica
    const db = mongoose.connection.    useDb(GLOBAL_CATALOGS_DB, { useCache: true });
    const text = (required) => ({ type: String, trim: true, required });
    const DocumentType = db.model(
        'DocumentType',
        new mongoose.Schema({
            dteType: { ...text(true), unique: true },
            controlNumber: text(true),
            serial: text(true),
            version: { type: Number, required: true, min: 1 },
            active: { type: Boolean, default: true },
            documentCode: { ...text(true), unique: true },
            description: text(true),
            createdAt: { type: Date, default: Date.now },
            updatedAt: Date
        }),
        'document_types'
    );

    const toDto = (doc) => {
        const { _id, __v, ...data } = doc.toObject();
        return { ...data, id: _id };
    };

    const pickData = (body) => {
        const data = {};
        for (const f of TEXT_FIELDS) {
            if (body[f] !== undefined) data[f] = String(body[f] ?? '').trim();
        }
        if (body.version !== undefined) data.version = Number(body.version);
        if (body.active !== undefined) data.active = !!body.active;
        return data;
    };

    const handleError = (res, error, fallback) => {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0];
            const label = field === 'documentCode' ? 'tipo de documento' : 'tipo DTE';
            return res.status(409).json({ error: `Ya existe un registro con ese ${label}` });
        }
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ error: 'Faltan campos obligatorios o son inválidos' });
        }
        res.status(500).json({ error: fallback });
    };

    app.get('/api/document-types', async (req, res) => {
        try {
            const items = await DocumentType.find().sort({ dteType: 1 });
            res.json(items.map(toDto));
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los tipos de documento' });
        }
    });

    app.post('/api/document-types', async (req, res) => {
        try {
            const saved = await new DocumentType(pickData(req.body)).save();
            res.status(201).json(toDto(saved));
        } catch (error) {
            handleError(res, error, 'Error al crear el tipo de documento');
        }
    });

    app.put('/api/document-types/:id', async (req, res) => {
        try {
            const updated = await DocumentType.findByIdAndUpdate(
                req.params.id,
                { $set: { ...pickData(req.body), updatedAt: new Date() } },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json(toDto(updated));
        } catch (error) {
            handleError(res, error, 'Error al actualizar el tipo de documento');
        }
    });

    app.delete('/api/document-types/:id', async (req, res) => {
        try {
            const deleted = await DocumentType.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json({ success: true, message: 'Registro eliminado correctamente' });
        } catch (error) {
            handleError(res, error, 'Error al eliminar el tipo de documento');
        }
    });

    // Mueve los registros de la base principal a la global (conservando los _id que usan las facturas) y elimina la colección original
    async function migrateFromMainDb() {
        const legacy = mongoose.connection.db.collection('document_types');
        if (!(await mongoose.connection.db.listCollections({ name: 'document_types' }).hasNext())) return;
        const docs = await legacy.find().toArray();
        for (const doc of docs) {
            await DocumentType.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
        }
        await legacy.drop();
        console.log(`Tipos de documento: ${docs.length} registros movidos a globalCatalogs`);
    }

    // Carga inicial solo si la colección está vacía
    return async function initDocumentTypes() {
        await DocumentType.init();
        await migrateFromMainDb();
        if ((await DocumentType.estimatedDocumentCount()) === 0) {
            await DocumentType.insertMany(SEED);
            console.log(`Tipos de documento: ${SEED.length} registros cargados`);
        }
    };
};
