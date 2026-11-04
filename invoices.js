// Facturación: encabezado + detalle en un solo documento (colección "invoices")
const { GLOBAL_CATALOGS_DB } = require('./db-config');
const registerInvoiceSequences = require('./invoice-sequences');

const IVA_RATE = 0.13;
const RETENTION_RATE = 0.01;
const RETENTION_MIN_BASE = 100;
const CREDITO_FISCAL_DTE = '03';
const EXPORT_DTE = '11';
const SERVICE_ITEM_CODE = '2';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Valores de una línea; el precio puede incluir IVA y las líneas exentas no generan IVA
const calcLine = (line) => {
    const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
    const exempt = !!line.exempt;
    const base = exempt || !line.valueWithIva ? gross : gross / (1 + IVA_RATE);
    const iva = exempt ? 0 : line.valueWithIva ? gross - base : base * IVA_RATE;
    return { value: exempt ? 0 : round2(base), exemptValue: exempt ? round2(base) : 0, iva: round2(iva) };
};

// La retención de IVA (1%) aplica a clientes gran contribuyente en crédito fiscal con base gravada >= 100
const calcInvoice = (lines, retentionAgent) => {
    const calculated = lines.map((l) => ({ ...l, ...calcLine(l), ivaRetention: 0 }));
    const taxable = calculated.reduce((s, l) => s + l.value, 0);
    if (retentionAgent && taxable >= RETENTION_MIN_BASE) {
        for (const l of calculated) l.ivaRetention = round2(l.value * RETENTION_RATE);
    }
    const sum = (field) => round2(calculated.reduce((s, l) => s + l[field], 0));
    const ventaTotal = round2(sum('value') + sum('exemptValue'));
    const iva = sum('iva');
    const ivaRetention = sum('ivaRetention');
    const subTotal = round2(ventaTotal + iva);
    return { lines: calculated, totals: { ventaTotal, iva, subTotal, ivaRetention, total: round2(subTotal - ivaRetention) } };
};

module.exports = function registerInvoices(app, mongoose) {
    const Client = mongoose.model('Client');

    const lineSchema = new mongoose.Schema({
        description: { type: String, required: true, trim: true },
        unit: { type: String, required: true },
        unitName: { type: String, default: '' },
        concept: { type: String, default: '' },
        conceptName: { type: String, default: '' },
        quantity: { type: Number, required: true, min: 0.0001 },
        unitPrice: { type: Number, required: true, min: 0 },
        exempt: { type: Boolean, default: false },
        valueWithIva: { type: Boolean, default: false },
        value: { type: Number, default: 0 },
        exemptValue: { type: Number, default: 0 },
        iva: { type: Number, default: 0 },
        ivaRetention: { type: Number, default: 0 }
    }, { _id: false });

    const Invoice = mongoose.model('Invoice', new mongoose.Schema({
        documentNumber: { type: String, unique: true },
        documentDate: { type: Date, required: true },
        documentType: { type: String, required: true },
        documentTypeId: { type: mongoose.Schema.Types.ObjectId, default: null },
        dteType: { type: String, default: '' },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        billToName: { type: String, required: true, trim: true },
        customsDeclarationNumber: { type: String, default: '', trim: true },
        itemTypeId: { type: mongoose.Schema.Types.ObjectId, default: null },
        itemTypeName: { type: String, default: '' },
        customsId: { type: mongoose.Schema.Types.ObjectId, default: null },
        customsName: { type: String, default: '' },
        regimeId: { type: mongoose.Schema.Types.ObjectId, default: null },
        regimeName: { type: String, default: '' },
        isExternalSale: { type: Boolean, default: false },
        accountingDescription: { type: String, default: '' },
        status: { type: String, enum: ['BORRADOR', 'ANULADA'], default: 'BORRADOR' },
        lines: { type: [lineSchema], default: [] },
        totals: {
            ventaTotal: { type: Number, default: 0 },
            iva: { type: Number, default: 0 },
            subTotal: { type: Number, default: 0 },
            ivaRetention: { type: Number, default: 0 },
            total: { type: Number, default: 0 }
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date
    }), 'invoices');

    const toDto = (doc) => {
        const { _id, __v, ...data } = doc.toObject();
        return { ...data, id: _id };
    };

    class HttpError extends Error {
        constructor(status, message) {
            super(message);
            this.status = status;
        }
    }

    const sequences = registerInvoiceSequences(app, mongoose, Invoice, HttpError);
    const { nextNumber, canDeleteInvoice, deleteIfLast } = sequences;

    // Tipo de documento según el Administrador de Documentos; una factura existente puede conservar un tipo que luego se inactive
    const resolveDocumentType = async (body, current) => {
        const DocumentType = mongoose.connection.useDb(GLOBAL_CATALOGS_DB, { useCache: true }).model('DocumentType');
        let type = null;
        if (body.documentTypeId) {
            if (!mongoose.isValidObjectId(body.documentTypeId)) throw new HttpError(400, 'Tipo de documento inválido');
            type = await DocumentType.findById(body.documentTypeId);
        } else if (body.documentType) {
            type = await DocumentType.findOne({ description: String(body.documentType).trim() });
        }
        if (!type) throw new HttpError(400, 'El tipo de documento no existe en el Administrador de Documentos');
        const unchanged = current?.documentTypeId && String(current.documentTypeId) === String(type._id);
        if (!type.active && !unchanged) throw new HttpError(400, 'El tipo de documento seleccionado está inactivo');
        return type;
    };

    // Datos de exportación (solo para tipo DTE 11): No. de declaración y catálogos de tipo de item, aduana y régimen
    const EXPORT_CATALOGS = [
        ['itemType', 'tipo_item', 'tipo de item'],
        ['customs', 'recinto_fiscal', 'aduana'],
        ['regime', 'regimen', 'régimen']
    ];

    const resolveExportData = async (body, docType, current) => {
        if (docType.dteType !== EXPORT_DTE) {
            const empty = { customsDeclarationNumber: '' };
            for (const [prefix] of EXPORT_CATALOGS) Object.assign(empty, { [`${prefix}Id`]: null, [`${prefix}Name`]: '' });
            return empty;
        }
        const data = { customsDeclarationNumber: String(body.customsDeclarationNumber || '').trim() };
        const db = mongoose.connection.useDb(GLOBAL_CATALOGS_DB, { useCache: true });
        let isServiceItem = false;
        if (mongoose.isValidObjectId(body.itemTypeId)) {
            const itemType = await db.collection('tipo_item').findOne({ _id: new mongoose.Types.ObjectId(body.itemTypeId) });
            isServiceItem = String(itemType?.code) === SERVICE_ITEM_CODE;
        }
        for (const [prefix, collection, label] of EXPORT_CATALOGS) {
            // Con tipo de item "Servicios" no aplican aduana ni régimen
            if (prefix !== 'itemType' && isServiceItem) {
                data[`${prefix}Id`] = null;
                data[`${prefix}Name`] = '';
                continue;
            }
            const id = body[`${prefix}Id`];
            if (!id) throw new HttpError(400, `Seleccione ${label} para la factura de exportación`);
            if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Valor inválido para ${label}`);
            const item = await db.collection(collection).findOne({ _id: new mongoose.Types.ObjectId(id) });
            if (!item) throw new HttpError(400, `El ${label} seleccionado no existe en el catálogo`);
            const unchanged = current && String(current[`${prefix}Id`]) === String(id);
            if (item.active === false && !unchanged) throw new HttpError(400, `El ${label} seleccionado está inactivo`);
            data[`${prefix}Id`] = item._id;
            data[`${prefix}Name`] = item.description;
        }
        return data;
    };

    // Arma los datos permitidos y recalcula siempre los importes en el servidor
    const buildData = async (body, current) => {
        const docType = await resolveDocumentType(body, current);
        if (!body.clientId) throw new HttpError(400, 'Debe seleccionar el cliente a facturar');
        const client = await Client.findById(body.clientId);
        if (!client) throw new HttpError(400, 'El cliente seleccionado no existe');

        const data = {
            documentDate: body.documentDate ? new Date(body.documentDate) : undefined,
            documentType: docType.description,
            documentTypeId: docType._id,
            dteType: docType.dteType,
            clientId: client._id,
            billToName: body.billToName,
            ...(await resolveExportData(body, docType, current)),
            isExternalSale: docType.dteType === EXPORT_DTE || !!body.isExternalSale,
            accountingDescription: body.accountingDescription || ''
        };

        const retentionAgent = client.isLargeTaxpayer && docType.dteType === CREDITO_FISCAL_DTE;

        // La exportación es siempre exenta
        const rawLines = (Array.isArray(body.lines) ? body.lines : []).map((l) => (docType.dteType === EXPORT_DTE ? { ...l, exempt: true } : l));
        const calculated = calcInvoice(rawLines, retentionAgent);
        data.lines = calculated.lines;
        data.totals = calculated.totals;
        return data;
    };

    const handleError = (res, error, fallback) => {
        if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
        if (error.code === 11000) return res.status(409).json({ error: 'Ya existe una factura con ese número de documento' });
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ error: 'Faltan datos obligatorios o son inválidos' });
        }
        console.error(fallback, error);
        return res.status(500).json({ error: fallback });
    };

    app.get('/api/invoices', async (req, res) => {
        try {
            const invoices = await Invoice.find().select('-lines').sort({ documentDate: -1, documentNumber: -1 });
            const rows = await Promise.all(invoices.map(async (invoice) => ({
                ...toDto(invoice),
                canDelete: await canDeleteInvoice(invoice)
            })));
            res.json(rows);
        } catch (error) {
            handleError(res, error, 'Error al obtener las facturas');
        }
    });

    app.get('/api/invoices/:id', async (req, res) => {
        try {
            const invoice = await Invoice.findById(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
            res.json(toDto(invoice));
        } catch (error) {
            handleError(res, error, 'Error al obtener la factura');
        }
    });

    app.post('/api/invoices', async (req, res) => {
        try {
            const data = await buildData(req.body);
            const invoice = new Invoice(data);
            invoice.documentNumber = req.body.documentNumber ? String(req.body.documentNumber).trim() : undefined;
            await invoice.validate();
            // El correlativo se consume solo cuando los datos ya son válidos
            if (!invoice.documentNumber) invoice.documentNumber = await nextNumber(invoice.documentDate, invoice.documentTypeId);
            const saved = await invoice.save();
            res.status(201).json(toDto(saved));
        } catch (error) {
            handleError(res, error, 'Error al crear la factura');
        }
    });

    app.put('/api/invoices/:id', async (req, res) => {
        try {
            const invoice = await Invoice.findById(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
            if (invoice.status === 'ANULADA') return res.status(409).json({ error: 'Una factura anulada no se puede modificar' });

            invoice.set({ ...(await buildData(req.body, invoice)), updatedAt: new Date() });
            const saved = await invoice.save();
            res.json(toDto(saved));
        } catch (error) {
            handleError(res, error, 'Error al actualizar la factura');
        }
    });

    app.post('/api/invoices/:id/annul', async (req, res) => {
        try {
            const invoice = await Invoice.findOneAndUpdate(
                { _id: req.params.id, status: 'BORRADOR' },
                { status: 'ANULADA', updatedAt: new Date() },
                { new: true }
            );
            if (!invoice) {
                const exists = await Invoice.exists({ _id: req.params.id });
                return exists
                    ? res.status(409).json({ error: 'La factura ya está anulada' })
                    : res.status(404).json({ error: 'Factura no encontrada' });
            }
            res.json(toDto(invoice));
        } catch (error) {
            handleError(res, error, 'Error al anular la factura');
        }
    });

    // Una factura solo se elimina si es la última de su correlativo; las anteriores se conservan anulándolas.
    app.delete('/api/invoices/:id', async (req, res) => {
        try {
            const invoice = await Invoice.findById(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
            await deleteIfLast(invoice);
            res.json({ success: true, message: 'Factura eliminada correctamente' });
        } catch (error) {
            handleError(res, error, 'Error al eliminar la factura');
        }
    });

    return async function initInvoices() {
        await Invoice.init();
        await sequences.init();
    };
};
