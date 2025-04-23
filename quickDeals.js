import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import authRoutes from './routes/authRoutes.js';
import { db } from './config/dbConfig.js';

dotenv.config();

const app = express();

// Compute __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = file.originalname.split('.').pop();
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + extension);
  }
});
const upload = multer({ storage });

// CORS Headers for preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Quick Deals API is running 🚀' });
});

// Deals endpoint: GET all deals
app.get('/deals', (req, res) => {
  const query = 'SELECT * FROM food_items';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ 
        status: 500,
        message: 'Database error',
        error: err.message
      });
    }
    res.status(200).json({
      status: 200,
      data: results
    });
  });
});

// File Upload Endpoint (if needed separately)
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.status(200).json({ message: 'File uploaded successfully', file: req.file });
});

// Create a new deal with image upload
app.post('/deals', upload.single('image'), (req, res) => {
  const dealData = req.body;
  
  // Use uploaded file if exists; otherwise fallback to dealData.image_url (or empty string)
  const image_url = req.file ? `uploads/${req.file.filename}` : (dealData.image_url || '');
  
  const query = `
    INSERT INTO food_items 
      (retailer_id, category_id, name, description, original_price, current_price, discount_percentage, quantity_available, minimum_order_quantity, expiration_date, \`condition\`, image_url)
    VALUES 
      (
        ${db.escape(dealData.retailer_id)},
        ${db.escape(dealData.category_id)},
        ${db.escape(dealData.name)},
        ${db.escape(dealData.description)},
        ${db.escape(dealData.original_price)},
        ${db.escape(dealData.current_price)},
        ${db.escape(dealData.discount_percentage)},
        ${db.escape(dealData.quantity_available)},
        ${db.escape(dealData.minimum_order_quantity)},
        ${db.escape(dealData.expiration_date)},
        ${db.escape(dealData.condition)},
        ${db.escape(image_url)}
      )
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error creating deal:', err);
      return res.status(500).json({ status: 500, message: "Error creating deal", error: err.message });
    }
    res.status(201).json({ status: 201, message: "Deal created successfully", dealId: results.insertId });
  });
});


// Update an existing deal with image upload support
app.put('/deals/:id', upload.single('image'), (req, res) => {
  const dealId = req.params.id;
  const dealData = req.body;
  
  // If a new file is uploaded, use it; otherwise, keep the existing image_url if provided in the body.
  const image_url = req.file ? `uploads/${req.file.filename}` : (dealData.image_url || '');
  
  const query = `
    UPDATE food_items SET
      retailer_id = ${db.escape(dealData.retailer_id)},
      category_id = ${db.escape(dealData.category_id)},
      name = ${db.escape(dealData.name)},
      description = ${db.escape(dealData.description)},
      original_price = ${db.escape(dealData.original_price)},
      current_price = ${db.escape(dealData.current_price)},
      discount_percentage = ${db.escape(dealData.discount_percentage)},
      quantity_available = ${db.escape(dealData.quantity_available)},
      minimum_order_quantity = ${db.escape(dealData.minimum_order_quantity)},
      expiration_date = ${db.escape(dealData.expiration_date)},
      \`condition\` = ${db.escape(dealData.condition)},
      image_url = ${db.escape(image_url)}
    WHERE food_id = ${db.escape(dealId)}
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error updating deal:', err);
      return res.status(500).json({ status: 500, message: "Error updating deal", error: err.message });
    }
    res.status(200).json({ status: 200, message: "Deal updated successfully" });
  });
});

// Delete a deal by id
app.delete('/deals/:id', (req, res) => {
  const dealId = req.params.id;
  const query = `DELETE FROM food_items WHERE food_id = ${db.escape(dealId)}`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error deleting deal:', err);
      return res.status(500).json({ status: 500, message: "Error deleting deal", error: err.message });
    }
    res.status(200).json({ status: 200, message: "Deal deleted successfully" });
  });
});

// Auth Routes
app.use('/quick_deals/authenticate', authRoutes);

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
