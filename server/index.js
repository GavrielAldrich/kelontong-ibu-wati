import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser"; // Import cookie-parser
import axios from "axios";
import Midtrans from "midtrans-client";
import dotenv from "dotenv";

dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT;
const SECRET_KEY = process.env.SECRET_KEY; // Replace with a secure key
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;

// Middleware
app.use(express.static(path.join(__dirname, "../views"))); // Serve static files from public/assets
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie-parser middleware
app.use(express.json()); // Add this line to parse JSON bodies

let snap = new Midtrans.Snap({
  // Set to true if you want Production Environment (accept real transaction).
  isProduction: false,
  serverKey: MIDTRANS_SERVER_KEY,
});

// =========== //
// USER AREA //
// =========== //

// GET Home page
app.get("/", function (req, res) {
  res.render("home"); // Render the login page
});

app.get("/about", function (req, res) {
  res.render("about");
});

app.get("/contact", function (req, res) {
  res.render("contact");
});

app.get("/cart", function (req, res) {
  res.render("cart");
});

app.get("/shop", async function (req, res) {
  try {
    const category = req.query.category || "all"; // Get the category from the query string
    const getMenus = await axios.get(process.env.API + "menus");
    const menus = Array.isArray(getMenus.data)
      ? getMenus.data
      : [getMenus.data];

    // Filter menus if necessary
    const filteredMenus =
      category !== "all"
        ? menus.filter((menu) => menu.menu_category === category)
        : menus;

    res.render("shop", { menus: filteredMenus, category });
  } catch (error) {
    console.log("Error on server: ", error);
    res.status(500).send("Error on server");
  }
});

app.get("/checkout", function (req, res) {
  res.render("checkout");
});

app.post("/checkout", async function (req, res) {
  try {
    const { cart, subtotal, fee, total } = req.body; // Extract data from the request body

    // Function to generate a random order ID
    function generateOrderId() {
      return "ORDER-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // Create the parameter object using the data from the request
    let parameter = {
      transaction_details: {
        order_id: generateOrderId(), // Generate a random order ID
        gross_amount: total, // Use the total amount sent in the request
      },
      credit_card: {
        secure: true, // Keep secure as true
      },
      customer_details: {
        first_name: "budi",
        last_name: "pratama",
        // Remove email and phone as per your requirement
        email: "budi.pra@example.com",
        phone: "08111222333",
      },
    };

    // Here you would typically call the payment API with the parameter
    // Example (pseudo-code):
    // const paymentResponse = await paymentAPI.createPayment(parameter);

    // Send a response back to the client
    snap.createTransaction(parameter).then((transaction) => {
      // transaction token
      let redirectURL = transaction.redirect_url;
      res.status(200).json({
        success: true,
        message: "Checkout processed successfully",
        parameter,
        redirect: redirectURL,
      });
    });
  } catch (error) {
    console.log("Error on server", error);
    res
      .status(500)
      .json({ success: false, message: "Error processing checkout" });
  }
});

app.get("/detail/:product_id", async function (req, res) {
  const { product_id } = req.params;
  const getProduct = await axios.get(process.env.API + `menus/${product_id}`);

  const product = Array.isArray(getProduct.data)
    ? getProduct.data
    : [getProduct.data];

  res.render("detail-product", { product });
});

// =========== //
// ADMIN AREA //
// =========== //

// Admin middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.cookies.token; // Read token from cookies
  if (!token) {
    return res.render("unauthenticated"); // Redirect to login if no token is found
  }

  // Verify token
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      res.clearCookie("token"); // Clear the cookie
      return res.send("Invalid token. Please log in again.");
    }
    req.user = decoded; // Pass decoded user data to the next middleware/route
    next();
  });
}

// GET auth view
app.get("/auth", function (req, res) {
  res.render("auth");
});

// POST to authenticate and generate token
app.post("/auth", async function (req, res) {
  const { username, password } = req.body;

  // Hard-coded admin authentication for demonstration purposes

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASS
  ) {
    // Generate JWT token
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });

    // Send the token as a cookie
    res.cookie("token", token, { httpOnly: true });
    return res.redirect("/admin");
  } else {
    return res.render("unauthenticated");
  }
});

// Logout route to destroy the token
app.post("/logout", function (req, res) {
  res.clearCookie("token"); // Clear the cookie
  res.redirect("/auth"); // Redirect to the home or login page
});

// GET Admin page (protected by JWT token)
app.get("/admin", verifyToken, async function (req, res) {
  try {
    res.render("admin");
  } catch (error) {
    console.log("Error on server", error);
    res.status(500).send("Error on server");
  }
});

// GET menus view
app.get("/admin/menus", verifyToken, async function (req, res) {
  try {
    const getMenus = await axios.get(process.env.API + "menus");

    // Assuming getMenu.data is an array; if not, wrap it in an array
    const menus = Array.isArray(getMenus.data)
      ? getMenus.data
      : [getMenus.data];
    res.render("menus", { menus });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// DELETE a menu item
app.post("/admin/menus/delete/:id", verifyToken, async function (req, res) {
  try {
    await axios.delete(process.env.API + `menus/${req.params.id}`);
    res.redirect("/admin/menus");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// GET edit form
app.get("/admin/menus/edit/:id", verifyToken, async function (req, res) {
  try {
    const menu = await axios.get(process.env.API`menus/${req.params.id}`);
    res.render("editMenu", { menu: menu.data });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// POST edit form submission (but it acts as PUT)
app.post("/admin/menus/edit/:id", verifyToken, async function (req, res) {
  const updatedMenu = {
    menu_title: req.body.title,
    menu_price: req.body.price,
    menu_category: req.body.category,
    menu_stock: req.body.stock,
    menu_image: req.body.image, // Ensure this matches your form fields
  };

  try {
    await axios.put(process.env.API + `menus/${req.params.id}`, updatedMenu);

    res.redirect("/admin/menus");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/orders", function (req, res) {
  res.render("orders");
});

// Catch-all route for unknown paths
app.get("/*", function (req, res) {
  res.render("404");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
