// Catálogos de Facturación Electrónica, almacenados en la base de datos "globalCatalogs".
// MongoDB crea la base de datos y cada colección en el primer guardado.
const crypto = require('crypto');
const seedData = require('./data/global-catalogs.json');

const { GLOBAL_CATALOGS_DB } = require('./db-config');

const CATALOGS = {
    'forma-pago': { label: 'Forma de pago', collection: 'forma_pago' },
    'paises': { label: 'Países', collection: 'paises', sort: { countryNumber: 1 } },
    'municipios': { label: 'Municipios', collection: 'municipios' },
    'recinto-fiscal': { label: 'Recinto Fiscal', collection: 'recinto_fiscal' },
    'regimen': { label: 'Régimen', collection: 'regimen' },
    'tipo-establecimiento': { label: 'Tipo de establecimiento', collection: 'tipo_establecimiento' },
    'tipo-item': { label: 'Tipo de item', collection: 'tipo_item' },
    'unidades-medida': { label: 'Unidades de medida', collection: 'unidades_medida' },
    'actividades-economicas': { label: 'Actividades económicas', collection: 'actividades_economicas' }
};

const HOME_COUNTRY_DESCRIPTION = 'EL SALVADOR';
const FOREIGN_MUNICIPALITY = /^Otro \(Para\s+extranjeros\)$/i;

module.exports = function registerGlobalCatalogs(app, mongoose) {
    const db = mongoose.connection.useDb(GLOBAL_CATALOGS_DB, { useCache: true });

    const baseDefinition = {
        code: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date
    };

    // Campos propios de cada catálogo (además de código, descripción y activo)
    const extraDefinitions = {
        paises: {
            countryNumber: { type: Number, required: true, min: 1 },
            isCentralAmerican: { type: Boolean, default: false }
        },
        municipios: {
            countryId: { type: mongoose.Schema.Types.ObjectId, default: null }
        }
    };

    const models = {};
    for (const [key, meta] of Object.entries(CATALOGS)) {
        models[key] = db.model(`Catalog_${key}`, new mongoose.Schema({ ...baseDefinition, ...(extraDefinitions[key] || {}) }), meta.collection);
    }

    const toDto = (doc) => {
        const { _id, __v, ...data } = doc.toObject();
        return { ...data, id: _id };
    };

    const invalid = (message) => Object.assign(new Error(message), { name: 'ValidationError' });

    const pickData = async (body, key) => {
        const data = {};
        if (body.code !== undefined) data.code = String(body.code).trim();
        if (body.description !== undefined) data.description = String(body.description).trim();
        if (body.active !== undefined) data.active = !!body.active;

        if (key === 'paises') {
            if (body.countryNumber !== undefined) data.countryNumber = Number(body.countryNumber);
            if (body.isCentralAmerican !== undefined) data.isCentralAmerican = !!body.isCentralAmerican;
        }
        if (key === 'municipios' && body.countryId !== undefined) {
            if (body.countryId === null || body.countryId === '') {
                data.countryId = null;
            } else {
                if (!mongoose.isValidObjectId(body.countryId) || !(await models.paises.exists({ _id: body.countryId }))) {
                    throw invalid('El país seleccionado no existe');
                }
                data.countryId = body.countryId;
            }
        }
        return data;
    };

    // Solo catálogos registrados: evita acceder a colecciones arbitrarias
    app.param('catalog', (req, res, next, key) => {
        if (!Object.prototype.hasOwnProperty.call(CATALOGS, key)) {
            return res.status(404).json({ error: 'Catálogo no encontrado' });
        }
        req.catalogKey = key;
        req.catalogModel = models[key];
        next();
    });

    app.get('/api/global-catalogs', (req, res) => {
        res.json(Object.entries(CATALOGS).map(([key, meta]) => ({ key, label: meta.label })));
    });

    app.get('/api/global-catalogs/:catalog', async (req, res) => {
        try {
            const sort = CATALOGS[req.catalogKey].sort || { code: 1 };
            const items = await req.catalogModel.find().collation({ locale: 'es', numericOrdering: true }).sort(sort);
            res.json(items.map(toDto));
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener el catálogo' });
        }
    });

    app.post('/api/global-catalogs/:catalog', async (req, res) => {
        try {
            const saved = await new req.catalogModel(await pickData(req.body, req.catalogKey)).save();
            res.status(201).json(toDto(saved));
        } catch (error) {
            if (error.name === 'ValidationError') {
                return res.status(400).json({ error: error.errors ? 'Complete los campos obligatorios' : error.message });
            }
            res.status(500).json({ error: 'Error al crear el registro' });
        }
    });

    app.put('/api/global-catalogs/:catalog/:id', async (req, res) => {
        try {
            const updated = await req.catalogModel.findByIdAndUpdate(
                req.params.id,
                { ...(await pickData(req.body, req.catalogKey)), updatedAt: new Date() },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json(toDto(updated));
        } catch (error) {
            if (error.name === 'ValidationError' || error.name === 'CastError') {
                return res.status(400).json({ error: error.errors ? 'Datos del registro inválidos' : error.message });
            }
            res.status(500).json({ error: 'Error al actualizar el registro' });
        }
    });

    app.delete('/api/global-catalogs/:catalog/:id', async (req, res) => {
        try {
            if (req.catalogKey === 'paises' && (await models.municipios.exists({ countryId: req.params.id }))) {
                return res.status(409).json({ error: 'No se puede eliminar: el país tiene municipios relacionados' });
            }
            const deleted = await req.catalogModel.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json({ success: true, message: 'Registro eliminado correctamente' });
        } catch (error) {
            if (error.name === 'CastError') return res.status(400).json({ error: 'Identificador inválido' });
            res.status(500).json({ error: 'Error al eliminar el registro' });
        }
    });

    /////////////////////////////// Parámetros Generales (datos de la empresa) ///////////////////////////////
    const TEXT_FIELDS = [
        'companyCode', 'companyName', 'nit', 'registration', 'address', 'establishmentType', 'phone', 'email',
        'economicActivity', 'tradeName', 'department', 'municipality',
        'feNit', 'environment', 'mailEmail', 'mailName', 'mailHost'
    ];
    // Credenciales: nunca se devuelven al cliente; si llegan vacías se conserva el valor guardado
    const SECRET_FIELDS = ['privatePassword', 'publicPassword', 'apiPassword', 'dgiPassword', 'mailPassword'];
    const REQUIRED_FIELDS = ['companyCode', 'companyName', 'nit', 'registration', 'address', 'establishmentType', 'phone', 'email', 'economicActivity', 'department', 'municipality'];

    const paramDefinition = {
        mailPort: { type: Number, default: 587 },
        mailEnableSsl: { type: Boolean, default: true },
        // El código de municipio se repite entre departamentos; el vínculo real es el ID
        municipalityId: { type: mongoose.Schema.Types.ObjectId, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: Date
    };
    for (const f of TEXT_FIELDS) {
        paramDefinition[f] = { type: String, trim: true, default: '', required: REQUIRED_FIELDS.includes(f) ? true : false };
    }
    paramDefinition.companyCode.unique = true;
    paramDefinition.environment.default = '01';
    for (const f of SECRET_FIELDS) paramDefinition[f] = { type: String, default: '' };

    const GeneralParameter = db.model('GeneralParameter', new mongoose.Schema(paramDefinition), 'parametros_generales');

    const paramToDto = (doc) => {
        const { _id, __v, ...data } = doc.toObject();
        const dto = { ...data, id: _id };
        for (const f of SECRET_FIELDS) {
            dto[`has${f[0].toUpperCase()}${f.slice(1)}`] = !!data[f];
            delete dto[f];
        }
        return dto;
    };

    const pickParamData = (body) => {
        const data = {};
        for (const f of TEXT_FIELDS) {
            if (f !== 'companyCode' && body[f] !== undefined) data[f] = String(body[f] ?? '').trim();
        }
        for (const f of SECRET_FIELDS) {
            if (body[f]) data[f] = String(body[f]);
        }
        if (body.mailPort !== undefined && body.mailPort !== null && body.mailPort !== '') {
            const port = parseInt(body.mailPort, 10);
            if (Number.isInteger(port) && port > 0 && port <= 65535) data.mailPort = port;
        }
        if (body.mailEnableSsl !== undefined) data.mailEnableSsl = !!body.mailEnableSsl;
        return data;
    };

    // Resuelve el municipio por ID y sincroniza el código guardado junto a él
    const resolveMunicipality = async (data, body) => {
        if (body.municipalityId === undefined) return;
        const id = body.municipalityId;
        if (!id || !mongoose.isValidObjectId(id)) {
            const err = new Error('Municipio inválido');
            err.name = 'ValidationError';
            throw err;
        }
        const muni = await models.municipios.findById(id).select('code');
        if (!muni) {
            const err = new Error('Municipio inválido');
            err.name = 'ValidationError';
            throw err;
        }
        data.municipalityId = muni._id;
        data.municipality = muni.code;
    };

    const paramError = (error, fallback, res) => {
        if (error.code === 11000) return res.status(409).json({ error: 'Ya existe una empresa con ese código' });
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ error: 'Faltan campos obligatorios o son inválidos' });
        }
        return res.status(500).json({ error: fallback });
    };

    app.get('/api/general-parameters', async (req, res) => {
        try {
            const items = await GeneralParameter.find().sort({ companyCode: 1 });
            res.json(items.map(paramToDto));
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los parámetros generales' });
        }
    });

    const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomCompanyCode = () => Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');

    // El código lo asigna el sistema; el índice único evita repetidos y se reintenta ante una colisión
    const createCompany = async (data) => {
        for (let attempt = 0; attempt < 10; attempt++) {
            const code = randomCompanyCode();
            if (await GeneralParameter.exists({ companyCode: code })) continue;
            try {
                return await new GeneralParameter({ ...data, companyCode: code }).save();
            } catch (error) {
                if (error.code === 11000 && error.keyPattern?.companyCode) continue;
                throw error;
            }
        }
        throw new Error('No se pudo generar un código de empresa único');
    };

    app.post('/api/general-parameters', async (req, res) => {
        try {
            const data = pickParamData(req.body);
            await resolveMunicipality(data, req.body);
            const saved = await createCompany(data);
            res.status(201).json(paramToDto(saved));
        } catch (error) {
            paramError(error, 'Error al crear los parámetros generales', res);
        }
    });

    app.put('/api/general-parameters/:id', async (req, res) => {
        try {
            const data = pickParamData(req.body);
            await resolveMunicipality(data, req.body);
            const updated = await GeneralParameter.findByIdAndUpdate(
                req.params.id,
                { $set: { ...data, updatedAt: new Date() } },
                { new: true, runValidators: true }
            );
            if (!updated) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json(paramToDto(updated));
        } catch (error) {
            paramError(error, 'Error al actualizar los parámetros generales', res);
        }
    });

    app.delete('/api/general-parameters/:id', async (req, res) => {
        try {
            const deleted = await GeneralParameter.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Registro no encontrado' });
            res.json({ success: true, message: 'Registro eliminado correctamente' });
        } catch (error) {
            if (error.name === 'CastError') return res.status(400).json({ error: 'Identificador inválido' });
            res.status(500).json({ error: 'Error al eliminar el registro' });
        }
    });

    // Carga inicial desde el Excel de catálogos; solo en colecciones vacías
    return async function seedGlobalCatalogs() {
        await GeneralParameter.createCollection().catch((err) => {
            if (err.codeName !== 'NamespaceExists') throw err;
        });
        await GeneralParameter.init();
        for (const key of Object.keys(CATALOGS)) {
            const rows = seedData[key] || [];
            if (!rows.length || (await models[key].estimatedDocumentCount()) > 0) continue;
            let toInsert = rows;
            if (key === 'municipios') {
                const home = await models.paises.findOne({ description: HOME_COUNTRY_DESCRIPTION });
                toInsert = rows.map((r) => ({ ...r, countryId: home && !FOREIGN_MUNICIPALITY.test(r.description) ? home._id : null }));
            }
            await models[key].insertMany(toInsert);
            console.log(`Catálogo ${CATALOGS[key].label}: ${rows.length} registros cargados en ${GLOBAL_CATALOGS_DB}`);
        }
        await linkMunicipalitiesToHomeCountry();
        await linkCompaniesToMunicipalities();
    };

    // Migra empresas que solo guardaban el código: busca por código y departamento (el nombre del municipio inicia con él)
    async function linkCompaniesToMunicipalities() {
        const pending = await GeneralParameter.find({ municipalityId: null });
        for (const company of pending) {
            const candidates = await models.municipios.find({ code: company.municipality });
            const match = candidates.find((m) => m.description.toUpperCase().startsWith(String(company.department).toUpperCase())) ||
                (candidates.length === 1 ? candidates[0] : null);
            if (match) {
                await GeneralParameter.updateOne({ _id: company._id }, { $set: { municipalityId: match._id } });
                console.log(`Empresa ${company.companyCode}: municipio vinculado a ${match.description}`);
            }
        }
    }

    // Relaciona con El Salvador los municipios que aún no tienen país asignado (excepto el de extranjeros).
    // Solo toca documentos sin el campo countryId; un valor null puesto a propósito se respeta.
    async function linkMunicipalitiesToHomeCountry() {
        const home = await models.paises.findOne({ description: HOME_COUNTRY_DESCRIPTION });
        if (!home) return;
        const unassigned = await models.municipios.find({ countryId: { $exists: false } }).select('description');
        const foreignIds = unassigned.filter((m) => FOREIGN_MUNICIPALITY.test(m.description)).map((m) => m._id);
        const homeIds = unassigned.filter((m) => !FOREIGN_MUNICIPALITY.test(m.description)).map((m) => m._id);
        if (homeIds.length) await models.municipios.updateMany({ _id: { $in: homeIds } }, { $set: { countryId: home._id } });
        if (foreignIds.length) await models.municipios.updateMany({ _id: { $in: foreignIds } }, { $set: { countryId: null } });
        if (unassigned.length) console.log(`Municipios relacionados: ${homeIds.length} con ${home.description}, ${foreignIds.length} sin país`);
    }
};
