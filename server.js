require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: "uploads/"
});

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);


/* DATABASE */

async function setupDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image TEXT DEFAULT '',
      stock INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      payment_reference TEXT,
      payment_status TEXT DEFAULT 'pending',
      order_status TEXT DEFAULT 'pending',
      items JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const admin =
    await pool.query(
      "SELECT id FROM admins LIMIT 1"
    );

  if (admin.rows.length === 0) {

    const username =
      process.env.ADMIN_USERNAME || "admin";

    const password =
      process.env.ADMIN_PASSWORD;

    if (!password) {
      throw new Error(
        "ADMIN_PASSWORD is missing"
      );
    }

    const hashed =
      await bcrypt.hash(
        password,
        12
      );

    await pool.query(
      `INSERT INTO admins
       (username, password)
       VALUES ($1, $2)`,
      [username, hashed]
    );

    console.log(
      "Admin account created."
    );
  }
}


/* ADMIN LOGIN */

app.post(
  "/api/admin/login",
  async (req, res) => {

    try {

      const {
        username,
        password
      } = req.body;

      const result =
        await pool.query(
          `SELECT *
           FROM admins
           WHERE username = $1`,
          [username]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(401).json({
          success: false,
          message:
            "Incorrect username or password."
        });

      }

      const admin =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          admin.password
        );

      if (!valid) {

        return res.status(401).json({
          success: false,
          message:
            "Incorrect username or password."
        });

      }

      const token =
        jwt.sign(
          {
            id: admin.id,
            username: admin.username
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "7d"
          }
        );

      res.json({
        success: true,
        token
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Login failed."
      });

    }

  }
);


/* AUTHENTICATION */

function authenticateAdmin(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization;

  if (
    !header ||
    !header.startsWith("Bearer ")
  ) {

    return res.status(401).json({
      success: false,
      message: "Login required."
    });

  }

  const token =
    header.replace(
      "Bearer ",
      ""
    );

  try {

    req.admin =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    next();

  } catch {

    res.status(401).json({
      success: false,
      message: "Invalid login."
    });

  }
}


/* GET PRODUCTS */

app.get(
  "/api/products",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `SELECT *
           FROM products
           ORDER BY id DESC`
        );

      res.json(
        result.rows
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Could not load products."
      });

    }

  }
);


/* ADD PRODUCT */

app.post(
  "/api/admin/products",
  authenticateAdmin,
  upload.single("image"),
  async (req, res) => {

    try {

      const {
        name,
        description,
        price,
        category,
        stock
      } = req.body;

      const image =
        req.file
          ? "/uploads/" +
            req.file.filename
          : "";

      const result =
        await pool.query(
          `INSERT INTO products
           (name, description, price,
            category, image, stock)
           VALUES
           ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            name,
            description || "",
            Number(price),
            category,
            image,
            Number(stock || 0)
          ]
        );

      res.json({
        success: true,
        product:
          result.rows[0]
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "Could not add product."
      });

    }

  }
);


/* DELETE PRODUCT */

app.delete(
  "/api/admin/products/:id",
  authenticateAdmin,
  async (req, res) => {

    try {

      await pool.query(
        `DELETE FROM products
         WHERE id = $1`,
        [Number(req.params.id)]
      );

      res.json({
        success: true
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false
      });

    }

  }
);


/* ADMIN ORDERS */

app.get(
  "/api/admin/orders",
  authenticateAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `SELECT *
           FROM orders
           ORDER BY id DESC`
        );

      res.json({
        success: true,
        orders:
          result.rows
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false
      });

    }

  }
);


/* HEALTH CHECK */

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await pool.query(
        "SELECT 1"
      );

      res.json({
        success: true,
        message:
          "Balyqueen server is running 👑"
      });

    } catch (error) {

      res.status(500).json({
        success: false
      });

    }

  }
);


/* START */

async function start() {

  try {

    await setupDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `Balyqueen running on port ${PORT}`
        );

      }
    );

  } catch (error) {

    console.error(
      "STARTUP ERROR:",
      error
    );

    process.exit(1);

  }

}

start();