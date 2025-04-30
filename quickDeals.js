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

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${unique}.${ext}`);
  }
});
const upload = multer({ storage });

// CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,PATCH');
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Quick Deals API is running 🚀' });
});

/** DEALS **/

// GET all deals
app.get('/deals', (req, res) => {
  db.query('SELECT * FROM food_items', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'Database error', error:err.message });
    }
    res.json({ status:200, data:results });
  });
});

// GET single deal
app.get('/deals/:id', (req, res) => {
  const id = db.escape(req.params.id);
  db.query(`SELECT * FROM food_items WHERE food_id=${id}`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'Database error', error:err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ status:404, message:'Deal not found' });
    }
    res.json({ status:200, data:rows[0] });
  });
});

// CREATE deal
app.post('/deals', upload.single('image'), (req, res) => {
  const d = req.body;
  const image_url = req.file ? `uploads/${req.file.filename}` : (d.image_url||'');
  const q = `
    INSERT INTO food_items
      (retailer_id,category_id,name,description,original_price,current_price,discount_percentage,quantity_available,minimum_order_quantity,expiration_date,\`condition\`,image_url)
    VALUES
      (${db.escape(d.retailer_id)},${db.escape(d.category_id)},${db.escape(d.name)},${db.escape(d.description)},
       ${db.escape(d.original_price)},${db.escape(d.current_price)},${db.escape(d.discount_percentage)},
       ${db.escape(d.quantity_available)},${db.escape(d.minimum_order_quantity)},
       ${db.escape(d.expiration_date)},${db.escape(d.condition)},${db.escape(image_url)})
  `;
  db.query(q, (err, r) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'Error creating deal', error:err.message });
    }
    res.status(201).json({ status:201, message:'Deal created', dealId:r.insertId });
  });
});

// UPDATE deal
app.put('/deals/:id', upload.single('image'), (req, res) => {
  const id = db.escape(req.params.id);
  const d = req.body;
  const image_url = req.file ? `uploads/${req.file.filename}` : (d.image_url||'');
  const q = `
    UPDATE food_items SET
      retailer_id=${db.escape(d.retailer_id)},
      category_id=${db.escape(d.category_id)},
      name=${db.escape(d.name)},
      description=${db.escape(d.description)},
      original_price=${db.escape(d.original_price)},
      current_price=${db.escape(d.current_price)},
      discount_percentage=${db.escape(d.discount_percentage)},
      quantity_available=${db.escape(d.quantity_available)},
      minimum_order_quantity=${db.escape(d.minimum_order_quantity)},
      expiration_date=${db.escape(d.expiration_date)},
      \`condition\`=${db.escape(d.condition)},
      image_url=${db.escape(image_url)}
    WHERE food_id=${id}
  `;
  db.query(q, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'Error updating deal', error:err.message });
    }
    res.json({ status:200, message:'Deal updated' });
  });
});

// DELETE deal
app.delete('/deals/:id', (req, res) => {
  const id = db.escape(req.params.id);
  db.query(`DELETE FROM food_items WHERE food_id=${id}`, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'Error deleting deal', error:err.message });
    }
    res.json({ status:200, message:'Deal deleted' });
  });
});

// GRAB deal (decrement quantity)
app.post('/deals/:id/grab', (req, res) => {
  const id = db.escape(req.params.id);
  db.query(`SELECT quantity_available FROM food_items WHERE food_id=${id}`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status:500, message:'DB error', error:err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ status:404, message:'Deal not found' });
    }
    const qty = rows[0].quantity_available;
    if (qty < 1) {
      return res.status(400).json({ status:400, message:'Sold out' });
    }
    db.query(
      `UPDATE food_items SET quantity_available = quantity_available - 1 WHERE food_id=${id}`,
      (e) => {
        if (e) {
          console.error(e);
          return res.status(500).json({ status:500, message:'Could not grab deal', error:e.message });
        }
        res.json({ status:200, message:'Grabbed', quantity_available: qty-1 });
      }
    );
  });
});


/** CART & ORDERS **/

// helper: get or create cart_id for user
function getCartId(userId, cb) {
  db.query('SELECT cart_id FROM carts WHERE user_id=?',[userId],(e,r)=>{
    if(e) return cb(e);
    if(r.length) return cb(null,r[0].cart_id);
    db.query('INSERT INTO carts (user_id) VALUES (?)',[userId],(e2,res2)=>{
      if(e2) return cb(e2);
      cb(null,res2.insertId);
    });
  });
}

// Add to cart
app.post('/cart/add', (req,res) => {
  const { user_id, food_id, quantity } = req.body;
  getCartId(user_id, (err, cartId) => {
    if(err) {
      console.error(err);
      return res.status(500).json({ message:'Error getting cart' });
    }
    const up = `
      INSERT INTO cart_items (cart_id, food_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `;
    db.query(up, [cartId, food_id, quantity], err2 => {
      if(err2) {
        console.error(err2);
        return res.status(500).json({ message:'Error adding to cart' });
      }
      res.json({ message:'Added to cart' });
    });
  });
});

// View cart
app.get('/cart/:userId', (req,res) => {
  const uid = req.params.userId;
  const q = `
    SELECT ci.cart_item_id, fi.food_id, fi.name, fi.current_price, ci.quantity, fi.image_url
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.cart_id
    JOIN food_items fi ON fi.food_id = ci.food_id
    WHERE c.user_id = ?
  `;
  db.query(q, [uid], (err, rows) => {
    if(err) {
      console.error(err);
      return res.status(500).json({ message:'Error fetching cart' });
    }
    res.json({ data: rows });
  });
});

// List delivery options
app.get('/delivery-options', (req,res) => {
  db.query('SELECT * FROM delivery_options', (err, rows) => {
    if(err) {
      console.error(err);
      return res.status(500).json({ message:'Error fetching delivery options' });
    }
    res.json({ data: rows });
  });
});

// Checkout -> create order
app.post('/checkout', (req,res) => {
  const { user_id, delivery_option, delivery_address } = req.body;
  // fetch cart items
  const qItems = `
    SELECT ci.food_id, ci.quantity, fi.current_price
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.cart_id
    JOIN food_items fi ON fi.food_id = ci.food_id
    WHERE c.user_id = ?
  `;
  db.query(qItems, [user_id], (err, items) => {
    if(err) {
      console.error(err);
      return res.status(500).json({ message:'Error reading cart' });
    }
    if(!items.length) {
      return res.status(400).json({ message:'Cart is empty' });
    }
    // compute total
    let total = items.reduce((sum,i)=>sum + i.quantity*i.current_price,0);
    // add delivery cost
    db.query('SELECT cost FROM delivery_options WHERE option_id=?',[delivery_option], (eOpt, rowsOpt) => {
      if(eOpt) {
        console.error(eOpt);
        return res.status(500).json({ message:'Error fetching delivery cost' });
      }
      total += rowsOpt[0].cost;
      // insert order
      db.query(
        'INSERT INTO orders (user_id,total_amount,delivery_option,delivery_address) VALUES (?,?,?,?)',
        [user_id, total, delivery_option, delivery_address],
        (eOrd, rOrd) => {
          if(eOrd) {
            console.error(eOrd);
            return res.status(500).json({ message:'Error creating order' });
          }
          const orderId = rOrd.insertId;
          // insert order items
          const arr = items.map(i=>[orderId, i.food_id, i.quantity, i.current_price]);
          db.query(
            'INSERT INTO order_items (order_id,food_id,quantity,price_at_purchase) VALUES ?',
            [arr],
            (eOI) => {
              if(eOI) {
                console.error(eOI);
                return res.status(500).json({ message:'Error creating order items' });
              }
              // clear cart
              db.query(
                'DELETE ci FROM cart_items ci JOIN carts c ON ci.cart_id=c.cart_id WHERE c.user_id=?',
                [user_id]
              );
              res.json({ message:'Order placed', order_id: orderId });
            }
          );
        }
      );
    });
  });
});

// GET a single order (with its items)
app.get('/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  // first fetch the order itself
  db.query(
    `SELECT o.order_id, o.user_id, o.total_amount, o.delivery_option, o.delivery_address, o.created_at,
            do.name  AS delivery_name, do.cost AS delivery_cost
       FROM orders o
       JOIN delivery_options do ON o.delivery_option = do.option_id
      WHERE o.order_id = ?`,
    [orderId],
    (err, orderRows) => {
      if (err) return res.status(500).json({ status:500, message:'Error fetching order', error:err.message });
      if (!orderRows.length) return res.status(404).json({ status:404, message:'Order not found' });

      // then fetch its items
      db.query(
        `SELECT oi.order_item_id, oi.food_id, fi.name, oi.quantity, oi.price_at_purchase, fi.image_url
           FROM order_items oi
           JOIN food_items fi ON oi.food_id = fi.food_id
          WHERE oi.order_id = ?`,
        [orderId],
        (err2, itemRows) => {
          if (err2) return res.status(500).json({ status:500, message:'Error fetching order items', error:err2.message });
          res.json({
            status: 200,
            data: {
              ...orderRows[0],
              items: itemRows
            }
          });
        }
      );
    }
  );
});

// GET all orders for a given user
app.get('/orders/user/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query(
    `SELECT order_id, total_amount, delivery_option, delivery_address, created_at
       FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ status:500, message:'Error fetching user orders', error:err.message });
      res.json({ status:200, data: rows });
    }
  );
});
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ status:400, message:'Name, email & message are required' });
  }

  const sql = `
    INSERT INTO contacts (name, email, message)
    VALUES (${db.escape(name)}, ${db.escape(email)}, ${db.escape(message)})
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error saving contact:', err);
      return res.status(500).json({ status:500, message:'Database error', error:err.message });
    }
    res.status(201).json({ status:201, message:'Thank you! We\'ll be in touch soon.' });
  });
});

// GET /contacts  
// Protected: returns all submissions (you can hook in JWT middleware if you like)
app.get('/contacts', (req, res) => {
  const sql = 'SELECT contact_id, name, email, message, created_at FROM contacts ORDER BY created_at DESC';
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching contacts:', err);
      return res.status(500).json({ status:500, message:'Database error', error:err.message });
    }
    res.json({ status:200, data:rows });
  });
});


// GET reviews for a deal
app.get('/deals/:id/reviews', (req, res) => {
  const dealId = db.escape(req.params.id);
  const sql = `
    SELECT r.review_id, r.rating, r.comment, r.created_at,
           u.user_name
    FROM reviews r
    JOIN user u ON u.user_id = r.user_id
    WHERE r.food_id = ${dealId}
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ status:500, message:err.message });
    res.json({ status:200, data: rows });
  });
});

// POST a new review
app.post('/deals/:id/reviews', (req, res) => {
  const dealId = parseInt(req.params.id,10);
  const { user_id, rating, comment } = req.body;
  if (!user_id||!rating||!comment) {
    return res.status(400).json({ status:400, message:'Missing fields' });
  }
  const sql = `INSERT INTO reviews (food_id,user_id,rating,comment) VALUES (?,?,?,?)`;
  db.query(sql, [dealId,user_id,rating,comment], (err, result) => {
    if (err) return res.status(500).json({ status:500, message:err.message });
    res.status(201).json({ status:201, message:'Review added', review_id: result.insertId });
  });
});

// Create a new review
// POST /reviews
// body: { user_id, food_id, rating (1–5), comment (optional) }
app.post('/reviews', (req, res) => {
  const { user_id, food_id, rating, comment } = req.body;
  if (!user_id || !food_id || !rating) {
    return res.status(400).json({ status: 400, message: 'user_id, food_id & rating are required' });
  }
  const sql = `
    INSERT INTO reviews (user_id, food_id, rating, comment)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [user_id, food_id, rating, comment || null], (err, result) => {
    if (err) {
      console.error('Error creating review:', err);
      return res.status(500).json({ status: 500, message: 'Error creating review', error: err.message });
    }
    res.status(201).json({
      status: 201,
      message: 'Review created',
      review_id: result.insertId
    });
  });
});

// Get all reviews for a given food item
// GET /reviews/:foodId
app.get('/reviews/:foodId', (req, res) => {
  const foodId = req.params.foodId;
  const sql = `
    SELECT r.review_id,
           r.user_id,
           u.user_name,
           r.rating,
           r.comment,
           r.created_at
    FROM reviews r
    JOIN user u ON u.user_id = r.user_id
    WHERE r.food_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [foodId], (err, rows) => {
    if (err) {
      console.error('Error fetching reviews:', err);
      return res.status(500).json({ status: 500, message: 'Error fetching reviews', error: err.message });
    }
    res.json({
      status: 200,
      data: rows
    });
  });
});

// Get aggregated rating info for a food item
// GET /ratings/:foodId
app.get('/ratings/:foodId', (req, res) => {
  const foodId = req.params.foodId;
  const sql = `
    SELECT review_count, avg_rating
    FROM food_ratings
    WHERE food_id = ?
  `;
  db.query(sql, [foodId], (err, rows) => {
    if (err) {
      console.error('Error fetching rating summary:', err);
      return res.status(500).json({ status: 500, message: 'Error fetching ratings', error: err.message });
    }
    if (!rows.length) {
      return res.json({ status: 200, data: { review_count: 0, avg_rating: null } });
    }
    res.json({ status: 200, data: rows[0] });
  });
});

// Update an existing review
// PUT /reviews/:reviewId
// body may include { rating, comment }
app.put('/reviews/:reviewId', (req, res) => {
  const reviewId = req.params.reviewId;
  const { rating, comment } = req.body;
  if (!rating && comment === undefined) {
    return res.status(400).json({ status: 400, message: 'Nothing to update' });
  }
  const updates = [];
  const params  = [];
  if (rating !== undefined) {
    updates.push('rating = ?');
    params.push(rating);
  }
  if (comment !== undefined) {
    updates.push('comment = ?');
    params.push(comment);
  }
  // always update timestamp
  updates.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE reviews
    SET ${updates.join(', ')}
    WHERE review_id = ?
  `;
  params.push(reviewId);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('Error updating review:', err);
      return res.status(500).json({ status: 500, message: 'Error updating review', error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 404, message: 'Review not found' });
    }
    res.json({ status: 200, message: 'Review updated' });
  });
});

// Delete a review
// DELETE /reviews/:reviewId
app.delete('/reviews/:reviewId', (req, res) => {
  const reviewId = req.params.reviewId;
  const sql = 'DELETE FROM reviews WHERE review_id = ?';
  db.query(sql, [reviewId], (err, result) => {
    if (err) {
      console.error('Error deleting review:', err);
      return res.status(500).json({ status: 500, message: 'Error deleting review', error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 404, message: 'Review not found' });
    }
    res.json({ status: 200, message: 'Review deleted' });
  });
});

// Auth routes
app.use('/quick_deals/authenticate', authRoutes);

// Start server
const PORT = process.env.PORT || 7001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
