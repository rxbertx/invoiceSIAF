require('dotenv').config();

// Única fuente de los nombres de base de datos del proyecto
module.exports = {
    MONGODB_URI: process.env.MONGODB_URI,
    MAIN_DB: process.env.MONGODB_DB || 'invoiceSIAF',
    GLOBAL_CATALOGS_DB: process.env.MONGODB_GLOBAL_DB || 'globalCatalogs'
};
