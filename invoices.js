// Facturación: encabezado + detalle en un solo documento (colección "invoices")
const { GLOBAL_CATALOGS_DB } = require('./db-config');
const registerInvoiceSequences = require('./invoice-sequences');

const IVA_RATE = 0.13;
const RETENTION_RATE = 0.01;
const RETENTION_MIN_BASE = 100;
const CREDITO_FISCAL_DTE = '03';

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
    const { nextNumber } = sequences;

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
            customsDeclarationNumber: body.customsDeclarationNumber || '',
            isExternalSale: !!body.isExternalSale,
            accountingDescription: body.accountingDescription || ''
        };

        const retentionAgent = client.isLargeTaxpayer && docType.dteType === CREDITO_FISCAL_DTE;

        const rawLines = Array.isArray(body.lines) ? body.lines : [];
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
            res.json(invoices.map(toDto));
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
            const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: 'ANULADA', updatedAt: new Date() }, { new: true });
            if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
            res.json(toDto(invoice));
        } catch (error) {
            handleError(res, error, 'Error al anular la factura');
        }
    });

    // Solo los borradores se eliminan; el resto se anula para conservar el correlativo
    app.delete('/api/invoices/:id', async (req, res) => {
        try {
            const deleted = await Invoice.findOneAndDelete({ _id: req.params.id, status: 'BORRADOR' });
            if (!deleted) {
                const exists = await Invoice.exists({ _id: req.params.id });
                return exists
                    ? res.status(409).json({ error: 'Solo se pueden eliminar facturas en borrador' })
                    : res.status(404).json({ error: 'Factura no encontrada' });
            }
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
