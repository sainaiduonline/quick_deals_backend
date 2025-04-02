import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import autenticationRoute from './routes/authRoutes.js';
import { db } from './config/dbConfig.js';

dotenv.config();
const app = express();

app.use(cors());

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        res.header('ACCESS-CONTROL-ALLOW-METHODS', 'PUT, POST, PATCH, GET, DELETE');
        return res.status(200).json({});
    }
    next();
});



app.use('/quick_deals/autenticate', autenticationRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server connected to port ${PORT}`);
});
