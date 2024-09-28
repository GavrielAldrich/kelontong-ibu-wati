import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser"; // Import cookie-parser
import axios from "axios";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "your_secret_key"; // Replace with a secure key

// Middleware
app.use(express.static(path.join(__dirname, "../views"))); // Serve static files from public/assets
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie-parser middleware

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

app.get("/shop", async function (req, res) {
  const category = req.query.category || "all"; // Get the category from the query string
  const getMenus = await axios.get("https://66f64cd3436827ced97689ed.mockapi.io/api/v1/menus");
  const menus = Array.isArray(getMenus.data) ? getMenus.data : [getMenus.data];

  // Filter menus if necessary
  const filteredMenus = category !== "all"
    ? menus.filter(menu => menu.menu_category === category)
    : menus;

  res.render("shop", { menus: filteredMenus, category });
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
    const getMenus = await axios.get(
      "https://66f64cd3436827ced97689ed.mockapi.io/api/v1/menus"
    );

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
    await axios.delete(
      `https://66f64cd3436827ced97689ed.mockapi.io/api/v1/menus/${req.params.id}`
    );
    res.redirect("/admin/menus");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// GET edit form
app.get("/admin/menus/edit/:id", verifyToken, async function (req, res) {
  try {
    const menu = await axios.get(
      `https://66f64cd3436827ced97689ed.mockapi.io/api/v1/menus/${req.params.id}`
    );
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
    await axios.put(
      `https://66f64cd3436827ced97689ed.mockapi.io/api/v1/menus/${req.params.id}`,
      updatedMenu
    );
    res.redirect("/admin/menus");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/admin/orders", function (req, res) {
  res.render("orders");
});

// GET auth view
app.get("/auth", function (req, res) {
  res.render("auth");
});

// POST to authenticate and generate token
app.post("/auth", async function (req, res) {
  const { username, password } = req.body;

  // Hard-coded admin authentication for demonstration purposes

  if (username === "admin" && password === "admin") {
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

// Catch-all route for unknown paths
app.get("/*", function (req, res) {
  res.render("404");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
