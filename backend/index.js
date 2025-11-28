const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("./event_management.db", (err) => {
  if (err) {
    console.error("DB connection error:", err);
    return;
  }
  console.log("Connected to SQLite database");
});

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    date TEXT,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    price INTEGER,
    image TEXT,
    details TEXT
  )`);

  // Insert default data
  const templates = [
    { title: "Elegant Wedding", description: "Royal indoor wedding theme with flower arches.", price: 25000, image: "/images/wedding1.jpg", details: "Includes floral archways, red carpet, golden chairs, lighting setup, and mandap." },
    { title: "Traditional Wedding", description: "Classic South Indian wedding setup with banana leaves.", price: 30000, image: "/images/wedding2.jpg", details: "Banana leaves, mandap, garlands, thoranams, and classical music." },
    { title: "Kids Birthday Party", description: "Colorful setup with cartoon balloons and cake table.", price: 8000, image: "/images/birthday1.jpg", details: "Stage setup, cartoon cutouts, balloons, and cake table." },
    { title: "Adult Birthday Bash", description: "Elegant evening decor for adult birthdays.", price: 10000, image: "/images/birthday2.jpg", details: "Neon lights, cake corner, music setup, and lounge decor." },
    { title: "Corporate Event", description: "Professional decor for business meetings or launches.", price: 20000, image: "/images/corporate1.jpg", details: "Podium, projector, banners, and branded backdrop." },
    { title: "Business Gala", description: "Formal setup for corporate galas and awards.", price: 22000, image: "/images/corporate2.jpg", details: "Stage, lighting, mic setup, guest seating arrangement." },
    { title: "Festival Celebration", description: "Traditional decor with lights and flowers for festivals.", price: 15000, image: "/images/festival1.jpg", details: "Diya decoration, torans, pooja area, and music setup." },
    { title: "Cultural Festival", description: "Colorful decor for cultural events and shows.", price: 17000, image: "/images/festival2.jpg", details: "Stage setup, cultural props, backdrop and lighting." },
    { title: "Silver Anniversary", description: "Romantic silver jubilee celebration decor.", price: 18000, image: "/images/anniversary1.jpg", details: "Silver theme, roses, anniversary couple stage, cake decor." },
    { title: "Golden Anniversary", description: "Golden jubilee decor with luxurious elements.", price: 20000, image: "/images/anniversary2.jpg", details: "Golden chairs, floral frame, lighting, and dinner setup." },
    { title: "Baby Shower Theme", description: "Pink and blue decor with cute baby elements.", price: 13000, image: "/images/babyshower1.jpg", details: "Cradle decor, balloons, photo booth and cake table." },
    { title: "Modern Baby Shower", description: "Trendy modern decor for baby showers.", price: 14000, image: "/images/babyshower2.jpg", details: "Neutral theme, props, modern lighting and cake corner." },
    { title: "Engagement Ceremony", description: "Floral and ring-themed decor for engagements.", price: 20000, image: "/images/engagement1.jpg", details: "Ring stage setup, flowers, lights, and guest seating." },
    { title: "Rustic Engagement", description: "Vintage style engagement decor.", price: 21000, image: "/images/engagement2.jpg", details: "Wooden props, rustic lighting, flower jars, ring table." },
    { title: "Graduation Party", description: "Joyful decor for graduates and friends.", price: 12000, image: "/images/graduation1.jpg", details: "Stage with caps & scrolls theme, balloons, lighting." },
    { title: "College Farewell", description: "Emotional yet classy farewell party decor.", price: 15000, image: "/images/graduation2.jpg", details: "Farewell board, message wall, photo area and lights." },
    { title: "Mehndi Ceremony", description: "Green-themed mehndi decor with floral curtains.", price: 16000, image: "/images/mehendi1.jpg", details: "Floral backdrop, seating for bride, henna corner." },
    { title: "Colorful Mehndi", description: "Vibrant cushions and mehndi party lighting.", price: 17000, image: "/images/mehendi2.jpg", details: "Bright cloth backdrop, LED lights, dhol and cushions." },
    { title: "Cocktail Party", description: "Stylish cocktail setup with lighting & drinks.", price: 18000, image: "/images/cocktail1.jpg", details: "Bar counter, lounge seating, neon lights, and DJ." },
    { title: "Night Cocktail Event", description: "Elegant evening cocktail with black & gold theme.", price: 19000, image: "/images/cocktail2.jpg", details: "String lights, gold props, classy seating and music." },
    { title: "College Reunion", description: "Friendly and youthful reunion setup.", price: 10000, image: "/images/reunion1.jpg", details: "Photo booth, memory wall, stage and mics." },
    { title: "Family Reunion", description: "Warm and welcoming family get-together decor.", price: 11000, image: "/images/reunion2.jpg", details: "Dining decor, entry welcome board, balloons." },
    { title: "Bridal Shower", description: "Classy bridal shower with florals and gifts.", price: 15000, image: "/images/bridal1.jpg", details: "Bride-to-be backdrop, games area, chair decor." },
    { title: "Vintage Bridal", description: "Retro theme bridal shower decoration.", price: 16000, image: "/images/bridal2.jpg", details: "Vintage frames, lace props, candles, and flowers." },
    { title: "Charity Gala", description: "Elegant decor for NGO/charity gala dinners.", price: 25000, image: "/images/gala.jpg", details: "Table setup, sponsor logos, red carpet and stage." },
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO event_templates (title, description, price, image, details) VALUES (?, ?, ?, ?, ?)");
  templates.forEach(t => stmt.run(t.title, t.description, t.price, t.image, t.details));
  stmt.finalize();

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_id INTEGER,
    name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    event_date TEXT,
    event_time TEXT,
    addons TEXT,
    total_price INTEGER,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES event_templates(id)
  )`);
});

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    console.log("Token missing in request");
    return res.status(401).json({ message: "Access denied, token missing" });
  }

  jwt.verify(token, "secret_key", (err, user) => {
    if (err) {
      console.log("JWT verify error:", err);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    console.log("Authenticated user from token:", user);
    req.user = user;
    next();
  });
};
app.post("/book-event", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const {
    eventId,
    name,
    email,
    phone,
    address,
    date,
    time,
    addons,
    totalPrice,
    additionalNotes
  } = req.body;

  const sql = `
    INSERT INTO bookings (
      user_id, event_id, name, email, phone, address,
      event_date, event_time, addons, total_price, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [
    userId,
    eventId,
    name,
    email,
    phone,
    address,
    date,
    time,
    JSON.stringify(addons), // Store addons as JSON string
    totalPrice,
    additionalNotes || ""
  ], function(err) {
    if (err) {
      console.error("Booking Error:", err);
      return res.status(500).json({ message: "❌ Server error while booking." });
    }
    res.json({ message: "🎉 Booking confirmed successfully!" });
  });
});



// Get all events
app.get("/events", (req, res) => {
  db.all("SELECT * FROM events", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Add new event (optional: protect this route if needed)
app.post("/events", (req, res) => {
  const { title, description, date } = req.body;
  const sql = "INSERT INTO events (title, description, date) VALUES (?, ?, ?)";
  db.run(sql, [title, description, date], function(err) {
    if (err) return res.status(500).send(err);
    res.json({ message: "Event added", id: this.lastID });
  });
});

// Signup route
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
    if (err) {
      console.error("Signup Error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (row) {
      return res.status(400).json({ message: "Email already registered" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
        name,
        email,
        hashedPassword,
      ], function(err) {
        if (err) {
          console.error("Signup Error:", err);
          return res.status(500).json({ message: "Server error" });
        }
        res.status(201).json({ message: "Signup successful!" });
      });
    } catch (err) {
      console.error("Signup Error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error("Login Error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      const token = jwt.sign({ id: user.id, name: user.name }, "secret_key", { expiresIn: "2h" });

      res.json({ message: "Login successful", token, user: { id: user.id, name: user.name } });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
});

// Get all event templates
app.get("/event-templates", (req, res) => {
  db.all("SELECT * FROM event_templates", [], (err, rows) => {
    if (err) {
      console.error("Fetch event templates error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(rows);
  });
});
// Get user’s bookings
app.get("/my-bookings", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT b.id AS booking_id, e.title, e.description, e.image, b.event_date as date
    FROM bookings b
    JOIN event_templates e ON b.event_id = e.id
    WHERE b.user_id = ?
  `, [userId], (err, rows) => {
    if (err) {
      console.error("Booking history error:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(rows);
  });
});




const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
