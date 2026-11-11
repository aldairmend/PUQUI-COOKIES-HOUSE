const path = require('path');
const fs = require('fs');
const express = require('express');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// En producción, la misma API sirve el frontend compilado con Vite (frontend/dist).
const dist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
