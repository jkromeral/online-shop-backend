import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import knex from "knex";
import bcrypt from "bcrypt";

const db = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password: "12345",
    database: "ecommerce",
  },
});

const app = express();

app.use(cors());

app.use(bodyParser.json());

// display products on home page

app.get("/", (req, res) => {
  db.select("*")
    .from("products")
    .then((product) => {
      res.json(product.slice(0, 24));
    });
});

// display products based on selected category

app.get("/category/:category/:currentPage", (req, res) => {
  let { category } = req.params;
  let { currentPage } = req.params;
  const pagination = {};
  const per_page = 30;
  const offset = (currentPage - 1) * per_page;

  category = category
    .replaceAll("-", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return Promise.all([
    db
      .count("* as count")
      .from("products")
      .where("product_category", category)
      .first(),
    db
      .select("*")
      .from("products")
      .where("product_category", category)
      .offset(offset)
      .limit(per_page),
  ]).then(([total, products]) => {
    let count = total.count;
    pagination.total = count;
    pagination.per_page = per_page;
    pagination.offset = offset;
    pagination.to = offset + products.length;
    pagination.last_page = Math.ceil(count / per_page);
    pagination.current_page = currentPage;
    pagination.from = offset;
    pagination.products = products;
    res.json(pagination);
  });
});

// display products based on searched item

app.get("/search", (req, res) => {
  let q = req.query.q;
  let page = req.query.page;
  const pagination = {};
  const per_page = 30;
  const offset = (page - 1) * per_page;

  q = q
    .replaceAll("-", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return Promise.all([
    db
      .count("* as count")
      .from("products")
      .where("product_name", "like", `%${q}%`)
      .first(),
    db
      .select("*")
      .from("products")
      .where("product_name", "like", `%${q}%`)
      .offset(offset)
      .limit(per_page),
  ]).then(([total, products]) => {
    let count = total.count;
    pagination.total = count;
    pagination.per_page = per_page;
    pagination.offset = offset;
    pagination.to = offset + products.length;
    pagination.last_page = Math.ceil(count / per_page);
    pagination.current_page = page;
    pagination.from = offset;
    pagination.products = products;
    res.json(pagination);
  });
});

// view selected item/product information

app.get("/product/:product_id", (req, res) => {
  const { product_id } = req.params;

  db.select("*")
    .from("products")
    .where("product_id", product_id)
    .then((product) => {
      res.json(product);
    });
});

// enable an item/product to be added to user's cart

app.post("/add-to-cart", (req, res) => {
  const {
    username,
    product_id,
    product_image,
    product_name,
    product_price,
    quantity,
    total_price,
  } = req.body;

  db("cart")
    .insert({
      username: username,
      product_id: product_id,
      product_image: product_image,
      product_name: product_name,
      product_price: product_price,
      quantity: quantity,
      total_price: total_price,
    })
    .then(() => res.json("Successfully added to cart."));
});

// enable to view user's cart

app.get("/cart/:username", (req, res) => {
  const { username } = req.params;

  db.select("*")
    .from("cart")
    .where("username", username)
    .then((user_cart) => {
      res.json(user_cart);
    });
});

// enable to increase quantity of an item/product

app.put("/increase-quantity", (req, res) => {
  const { username, product_id, product_price } = req.body;

  db.select("*")
    .from("cart")
    .where("username", username)
    .andWhere("product_id", product_id)
    .increment({
      quantity: 1,
      total_price: product_price,
    })
    .then(() => {
      db.select("quantity", "total_price")
        .from("cart")
        .where("username", username)
        .andWhere("product_id", product_id)
        .then((data) => res.json(data));
    });
});

// enable to decrease quantity of an item/product

app.put("/decrease-quantity", (req, res) => {
  const { username, product_id, product_price } = req.body;

  db.select("*")
    .from("cart")
    .where("username", username)
    .andWhere("product_id", product_id)
    .decrement({
      quantity: 1,
      total_price: product_price,
    })
    .then(() => {
      db.select("quantity", "total_price")
        .from("cart")
        .where("username", username)
        .andWhere("product_id", product_id)
        .then((data) => {
          res.json(data);
        });
    });
});

// enable a product to be removed from user's cart

app.put("/remove-item", (req, res) => {
  const { username, product_id } = req.body;

  db.select("*")
    .from("cart")
    .where("username", username)
    .andWhere("product_id", product_id)
    .del()
    .then(() => res.json("Successfully removed an item."));
});

// enable to order selected items on user's cart

app.post("/add-to-order", (req, res) => {
  const orderedItems = req.body.map((item) => {
    return {
      username: item.username,
      product_id: item.product_id,
      product_image: item.product_image,
      product_name: item.product_name,
      product_price: item.product_price,
      quantity: item.quantity,
      total_price: item.total_price,
      username: item.username,
    };
  });

  const username = db.select("username").from("orders");
  const product_id = db.select("product_id").from("orders");

  db("orders")
    .insert(orderedItems)
    .then(() => {
      db.select("*")
        .from("cart")
        .whereIn("username", username)
        .whereIn("product_id", product_id)
        .del()
        .then(() => res.json("Successfully purchased."));
    });
});

// enable to view ordered items

app.get("/orders/:username", (req, res) => {
  const { username } = req.params;

  db.select("*")
    .from("orders")
    .where("username", username)
    .then((user_order_details) => {
      res.json(user_order_details);
    });
});

// login

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.select("username", "password")
    .from("users")
    .where("username", username)
    .then((user) => {
      const match = bcrypt.compareSync(password, user[0].password);
      if (match) {
        db.select("username", "first_name", "last_name")
          .from("users")
          .where("username", username)
          .then((data) => res.json(data));
      } else {
        res.json("Unable to login");
      }
    })
    .catch(() => res.json("Username doesn't exist"));
});

// sign up

app.post("/signup", (req, res) => {
  const { username, password, first_name, last_name, mobile_number } = req.body;

  bcrypt.hash(password, 10).then((hash) => {
    db("users")
      .returning(["username", "first_name", "last_name"])
      .insert({
        username: username,
        password: hash,
        first_name: first_name,
        last_name: last_name,
        mobile_number: mobile_number,
      })
      .then((user) => {
        res.json(user);
      });
  });
});

app.listen(3001);
