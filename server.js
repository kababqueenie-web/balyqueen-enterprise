require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET_BEFORE_LAUNCH";


/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});


/* =========================
   MIDDLEWARE
========================= */

app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);


/* =========================
   UPLOADS
========================= */

const uploadsFolder =
  path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsFolder)) {
  fs.mkdirSync(uploadsFolder, {
    recursive: true
  });
}


const storage = multer.diskStorage({

  destination: function (req, file, cb) {

    cb(null, uploadsFolder);

  },

  filename: function (req, file, cb) {

    const extension =
      path.extname(file.originalname)
        .toLowerCase();

    const filename =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1000000000) +
      extension;

    cb(null, filename);

  }

});


const upload = multer({

  storage: storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {

    const allowed =
      [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];

    if (allowed.includes(file.mimetype)) {

      cb(null, true);

    } else {

      cb(
        new Error(
          "Only image files are allowed."
        )
      );

    }

  }

});


app.use(
  "/uploads",
  express.static(uploadsFolder)
);


/* =========================
   FRONTEND
========================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================
   DATABASE SETUP
========================= */

async function setupDatabase() {

  await pool.query(`

    CREATE TABLE IF NOT EXISTS admins (

      id SERIAL PRIMARY KEY,

      username TEXT UNIQUE NOT NULL,

      password TEXT NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    );

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

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    );

  `);


  await pool.query(`

    CREATE TABLE IF NOT EXISTS orders (

      id SERIAL PRIMARY KEY,

      customer_name TEXT NOT NULL,

      customer_email TEXT NOT NULL,

      customer_phone TEXT NOT NULL,

      customer_address TEXT NOT NULL,

      total_amount INTEGER NOT NULL,

      payment_reference TEXT UNIQUE,

      payment_status TEXT DEFAULT 'pending',

      order_status TEXT DEFAULT 'pending',

      items JSONB NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    );

  `);


  /*
     Create the first admin account
     only if no admin exists.
  */

  const admin =
    await pool.query(
      "SELECT id FROM admins LIMIT 1"
    );


  if (admin.rows.length === 0) {

    const username =
      process.env.ADMIN_USERNAME ||
      "admin";

    const password =
      process.env.ADMIN_PASSWORD;

    if (!password) {

      console.log(
        "WARNING: ADMIN_PASSWORD is not configured."
      );

    } else {

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      await pool.query(

        `INSERT INTO admins
         (username, password)
         VALUES ($1, $2)`,

        [
          username,
          hashedPassword
        ]

      );

      console.log(
        "Initial admin account created."
      );

    }

  }

}


/* =========================
   ADMIN AUTHENTICATION
========================= */

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

      message: "Admin login required."

    });

  }


  const token =
    header.substring(7);


  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );


    req.admin =
      decoded;


    next();

  } catch {

    return res.status(401).json({

      success: false,

      message: "Invalid or expired login."

    });

  }

}


/* =========================
   ADMIN LOGIN
========================= */

app.post(
  "/api/admin/login",
  async (req, res) => {

    try {

      const {
        username,
        password
      } = req.body;


      if (!username || !password) {

        return res.status(400).json({

          success: false,

          message:
            "Username and password are required."

        });

      }


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


      const passwordCorrect =
        await bcrypt.compare(
          password,
          admin.password
        );


      if (!passwordCorrect) {

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

            username:
              admin.username

          },

          JWT_SECRET,

          {
            expiresIn:
              "7d"
          }

        );


      res.json({

        success: true,

        token,

        username:
          admin.username

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({

        success: false,

        message:
          "Login failed."

      });

    }

  }
);


/* =========================
   GET PRODUCTS
========================= */

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


/* =========================
   ADD PRODUCT
========================= */

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


      if (
        !name ||
        !price ||
        !category
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Name, price and category are required."

        });

      }


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

            Math.round(
              Number(price)
            ),

            category,

            image,

            Math.max(
              0,
              Number(stock || 0)
            )

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


/* =========================
   EDIT PRODUCT
========================= */

app.put(
  "/api/admin/products/:id",

  authenticateAdmin,

  upload.single("image"),

  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      const {
        name,
        description,
        price,
        category,
        stock
      } = req.body;


      const existing =
        await pool.query(

          `SELECT *
           FROM products
           WHERE id = $1`,

          [id]

        );


      if (
        existing.rows.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Product not found."

        });

      }


      const old =
        existing.rows[0];


      const image =
        req.file
          ? "/uploads/" +
            req.file.filename
          : old.image;


      const result =
        await pool.query(

          `UPDATE products

           SET name = $1,
               description = $2,
               price = $3,
               category = $4,
               image = $5,
               stock = $6,
               updated_at = CURRENT_TIMESTAMP

           WHERE id = $7

           RETURNING *`,

          [

            name ?? old.name,

            description ??
              old.description,

            price !== undefined
              ? Math.round(
                  Number(price)
                )
              : old.price,

            category ??
              old.category,

            image,

            stock !== undefined
              ? Math.max(
                  0,
                  Number(stock)
                )
              : old.stock,

            id

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
          "Could not update product."

      });

    }

  }
);


/* =========================
   DELETE PRODUCT
========================= */

app.delete(
  "/api/admin/products/:id",

  authenticateAdmin,

  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      const result =
        await pool.query(

          `DELETE FROM products
           WHERE id = $1
           RETURNING *`,

          [id]

        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Product not found."

        });

      }


      res.json({

        success: true,

        message:
          "Product deleted."

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({

        success: false,

        message:
          "Could not delete product."

      });

    }

  }
);


/* =========================
   CREATE ORDER + PAYSTACK
========================= */

app.post(
  "/api/pay",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const {
        email,
        name,
        phone,
        address,
        items
      } = req.body;


      if (
        !email ||
        !name ||
        !phone ||
        !address ||
        !Array.isArray(items) ||
        items.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Complete customer and cart details are required."

        });

      }


      await client.query(
        "BEGIN"
      );


      let total = 0;

      const verifiedItems = [];


      /*
        Get the real product prices
        and stock from the database.

        We NEVER trust the price
        sent by the customer's phone.
      */

      for (
        const item of items
      ) {

        const productResult =
          await client.query(

            `SELECT *
             FROM products
             WHERE id = $1
             FOR UPDATE`,

            [Number(item.id)]

          );


        if (
          productResult.rows.length === 0
        ) {

          throw new Error(
            "A product in your cart no longer exists."
          );

        }


        const product =
          productResult.rows[0];


        const quantity =
          Number(item.quantity);


        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {

          throw new Error(
            "Invalid product quantity."
          );

        }


        if (
          product.stock < quantity
        ) {

          throw new Error(

            `${product.name} does not have enough stock.`

          );

        }


        const itemTotal =
          product.price *
          quantity;


        total += itemTotal;


        verifiedItems.push({

          id:
            product.id,

          name:
            product.name,

          price:
            product.price,

          quantity:
            quantity

        });

      }


      /*
        Create a pending order first.
      */