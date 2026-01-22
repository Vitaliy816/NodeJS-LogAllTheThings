const express = require('express');
const path = require('path');
const { createLogger } = require('./logger');

const app = express();

const logger = createLogger({
    logDir: path.join(__dirname, 'logs'),
    maxLines: 3,
});

app.use(logger.requestLogger);

app.get('/', (req, res) => {
    res.status(200).send("ok");
});

app.get("/logs", logger.getLogs);

module.exports = app;
