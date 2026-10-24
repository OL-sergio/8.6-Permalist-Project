import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// TODO: render.com provides the PORT and HOST environment variables,
// so we need to use those instead of hardcoding them
//  const PORT = process.env.PORT || 10000;
//  const HOST = process.env.HOST || '0.0.0.0';

//  TODO: For local development, you can uncomment the lines
//  below and comment out the lines above
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || 'localhost';



const dbUrlKey = Object.keys(process.env).find(k => 
  /^(database_url|internal_database_url|external_database_url|postgres_url|db_url)$/i.test(k.trim())
);
const connectionString = dbUrlKey ? process.env[dbUrlKey]?.trim() : null;

const relatedKeys = Object.keys(process.env).filter(k => 
  /data|db|postgres|pg|url/i.test(k)
);
console.log("Database-related environment variables detected:", relatedKeys);

if (connectionString) {
  console.log(`Connecting using ${dbUrlKey}...`);
} else if (process.env.PGHOST && process.env.PGHOST !== "localhost") {
  console.log(`Connecting using PGHOST (${process.env.PGHOST})...`);
} else {
  console.log("Warning: No database connection URL found in environment variables. Falling back to localhost...");
}

const db = new pg.Client(
  connectionString
    ? {
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.PGUSER || "postgres",
        host: process.env.PGHOST || "localhost",
        database: process.env.PGDATABASE || "permalist",
        password: process.env.PGPASSWORD || "",
        port: Number(process.env.PGPORT || 5432),
        ssl: process.env.PGHOST && process.env.PGHOST !== "localhost" ? { rejectUnauthorized: false } : false
      }
);

if (!connectionString && !process.env.PGPASSWORD) {
  console.error("Error: Database password is required. Please set PGPASSWORD or DATABASE_URL environment variable.");
  process.exit(1);
}

async function initDatabase() {
  try {
    await db.query("BEGIN");

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(55) NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS day (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        date VARCHAR(55) NOT NULL,
        id_user INTEGER REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        date VARCHAR(55) NOT NULL,
        id_user INTEGER REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS months (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        date VARCHAR(55) NOT NULL,
        id_user INTEGER REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    const userCount = await db.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      const userResult = await db.query(
        "INSERT INTO users (name, color) VALUES ('Filipe', 'blue') RETURNING id, name"
      );

      const filipeId = userResult.rows[0].id;

      await db.query(
        "INSERT INTO day (title, date, id_user) VALUES ('Passeio do cão', '25/06/2026', $1), ('Fazer compras', '25/06/2026', $1)",
        [filipeId]
      );

      await db.query(
        "INSERT INTO months (title, date, id_user) VALUES ('Pagar Seguro carro', '24/06/2026', $1), ('Pagar imposto de selo', '22/06/2026', $1)",
        [filipeId]
      );

      await db.query(
        "INSERT INTO weeks (title, date, id_user) VALUES ('ver impostos pagar', '26/06/2026', $1), ('ver comida de cão', '30/06/2026', $1)",
        [filipeId]
      );

      console.log("Database initialized with default tables and data.");
    }

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

try {
  console.log(`Connecting to database at host: "${db.host}" port: ${db.port}...`);
  await db.connect();
  console.log("Database connected successfully");
  await initDatabase();
} catch (error) {
  console.error("Database connection failed:", error.message || error);
  if (db.host === "localhost" || db.host === "127.0.0.1") {
    console.error("-> The app is trying to connect to localhost. Please set the DATABASE_URL environment variable in your Render Web Service settings.");
  } else {
    console.error(`-> Failed to connect to ${db.host}:${db.port}. If using the Internal Database URL, verify both services are in the same Render region, or try using the External Database URL instead.`);
  }
  process.exit(1);
}

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

async function checkTasks(tableName, userId) {
  validateTable(tableName);
  const result = await db.query(
    `SELECT ${tableName}.id, title FROM ${tableName} JOIN users ON users.id = id_user WHERE id_user = $1`,
    [userId]
  );
  return result.rows;
}

async function checkTasksDay(userId) {
  return checkTasks('day', userId);
}

async function checkTasksWeek(userId) {
  return checkTasks('weeks', userId);
}

async function checkTasksMonths(userId) {
  return checkTasks('months', userId);
}

async function getCurrentUsers(req, res) {
  const usersResult = await db.query("SELECT * FROM users");
  const users = usersResult.rows;
  if (users.length === 0) {
    return { users: [], currentUser: null };
  }

  let userId = req.cookies.userId;
  let found = users.find((user) => user.id == userId);

  if (!found) {
    found = users[0];
    res.cookie('userId', found.id, { httpOnly: true, sameSite: 'lax' });
  }

  return { users, currentUser: found };
}


const VALID_TABLES = ['day', 'weeks', 'months'];

function validateTable(name) {
  if (!VALID_TABLES.includes(name)) throw new Error(`Invalid table: ${name}`);
  return name;
}

 function addItemToDatabase(tableName, item, date, userId) {
      validateTable(tableName);
      return db.query(
        `INSERT INTO ${tableName} (title, date, id_user) VALUES ($1, $2, $3)`, 
        [item, date, userId]
      );
    }

  function deleteItemFromDatabase(tableName, id, userId) {
      validateTable(tableName);
      return db.query(
        `DELETE FROM ${tableName} WHERE id = $1 AND id_user = $2`, 
        [id, userId]
      );
    } 

  function updateItemInDatabase(tableName, item, date, id, userId) {
      validateTable(tableName);
      return db.query(
        `UPDATE ${tableName} SET title = $1, date = $2 WHERE id = $3 AND id_user = $4`, 
        [item, date, id, userId]
      );
    }

  function DateFormate() {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');

      return `${day}-${month}-${year}`;
    }


app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs", { error: null });
  } else {
    const selectedUser = req.body.user || req.body.add;
    if (selectedUser) {
      const parsed = parseInt(selectedUser, 10);
      if (!isNaN(parsed)) {
        res.cookie('userId', parsed, { httpOnly: true, sameSite: 'lax' });
      }
    }
    res.redirect("/");
  }  
});


app.get("/", async (req, res) => {
  try {
    const { users, currentUser } = await getCurrentUsers(req, res);
    if (!currentUser) {
      res.render("new.ejs", { error: null });
      return;
    }

    const dayResult = await checkTasksDay(currentUser.id);
    const weekResult = await checkTasksWeek(currentUser.id);
    const monthResult = await checkTasksMonths(currentUser.id);
   
    console.log("Current User:", currentUser);
    console.log("Tasks for the Day:", dayResult);
    console.log("Tasks for the Week:", weekResult);
    console.log("Tasks for the Month:", monthResult);
  

    res.render("index.ejs", {
      taskDay: dayResult,
      taskWeek: weekResult,
      taskMonth: monthResult,
      currentUser: currentUser,
      users: users,
      color: currentUser.color,
  });
  }catch (error) {
    console.error("Error fetching items from the database:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/add", async (req, res) => {
  const itemDay = req.body.newItemDay;
  const itemWeek = req.body.newItemWeek;
  const itemMonth = req.body.newItemMonth;
  const date = DateFormate();
  const list = req.body.list;
  console.log("Selected value:", list);

  
  try {
    const { currentUser } = await getCurrentUsers(req, res);
    if (!currentUser) {
      res.redirect("/new");
      return;
    }

    let tableName = '';
    let item = '';
    if (list === 'Day' && itemDay) {
      tableName = 'day';
      item = itemDay;
      await addItemToDatabase(tableName, item, date, currentUser.id);
    } else if (list === 'Week' && itemWeek) {
      tableName = 'weeks';
      item = itemWeek;
      await addItemToDatabase(tableName, item, date, currentUser.id);
    } else if (list === 'Month' && itemMonth) {
      tableName = 'months';
      item = itemMonth;
      await addItemToDatabase(tableName, item, date, currentUser.id);
    }else {
      res.status(400).send("Bad Request: No item provided for the selected list.");
      return;
    }
    
   
    res.redirect("/");

  } catch (error) {
    console.error("Error adding item to the database:", error);
     res.status(500).send("Internal Server Error");
  }
});



app.post("/edit", async (req, res) => {
  const updatedItemTitleDay = req.body.updatedItemTitleDay;
  const updatedItemTitleWeek = req.body.updatedItemTitleWeek;
  const updatedItemTitleMonth = req.body.updatedItemTitleMonth;

  const updatedItemIdDay = req.body.updatedItemIdDay;
  const updatedItemIdWeek = req.body.updatedItemIdWeek;
  const updatedItemIdMonth = req.body.updatedItemIdMonth;

  const date = DateFormate();
  const list = req.body.list;

  try {
    const { currentUser } = await getCurrentUsers(req, res);
    if (!currentUser) {
      res.redirect("/new");
      return;
    }

    let tableName = '';
    let item = '';
    let id = '';

    if (list === 'Day' && updatedItemIdDay) {
      tableName = 'day';
      item = updatedItemTitleDay;
      id = updatedItemIdDay;
      await updateItemInDatabase(tableName, item, date, id, currentUser.id);
    } else if (list === 'Week' && updatedItemIdWeek) {
      tableName = 'weeks';
      item = updatedItemTitleWeek;  
      id = updatedItemIdWeek;
      await updateItemInDatabase(tableName, item, date, id, currentUser.id);
    } else if (list === 'Month' && updatedItemIdMonth) {
      tableName = 'months';
      item = updatedItemTitleMonth;
      id = updatedItemIdMonth;
      await updateItemInDatabase(tableName, item, date, id, currentUser.id);
    }
    res.redirect("/");

  }catch (error) {
    console.error("Error updating item in the database:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/delete", async (req, res) => {
  const idDay = req.body.deleteItemIdDay; 
  const idWeek = req.body.deleteItemIdWeek 
  const idMonth = req.body.deleteItemIdMonth; 
  const list = req.body.list; // Get the list type (Day, Week, or Month)

  try {
    const { currentUser } = await getCurrentUsers(req, res);
    if (!currentUser) {
      res.redirect("/new");
      return;
    }

    let tableName = '';
    let id = '';

    if (list === 'Day' && idDay) {
      tableName = 'day';
      id = idDay;
      await deleteItemFromDatabase(tableName, id, currentUser.id);
    } else if (list === 'Week'  && idWeek) {
      tableName = 'weeks';
      id = idWeek;
      await deleteItemFromDatabase(tableName, id, currentUser.id);
    } else if (list === 'Month' && idMonth) {
      tableName = 'months';
      id = idMonth;
      await deleteItemFromDatabase(tableName, id, currentUser.id);
    }
    res.redirect("/");
  }catch (error) {
    console.error("Error deleting item from the database:", error);
    res.status(500).send("Internal Server Error");
  }
});
  
app.get("/new", (req, res) => {
  res.render("new.ejs", { error: null });
});

app.post("/new", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs", { error: null });
    return;
  }

  if (!req.body.name || !req.body.color) {
    res.render("new.ejs", {
      error: "Please provide both name and color.",
    });
    return;
  }

  try {
    const name = req.body.name;
    const color = req.body.color;

    // Número atual de utilizadores
    const countResult = await db.query(
      "SELECT COUNT(*) AS total FROM users"
    );

    const totalUsers = Number(countResult.rows[0].total);
    console.log("Total users:", totalUsers);

    // O PostgreSQL gera automaticamente o próximo ID
    const result = await db.query(
      `INSERT INTO users (name, color)
       VALUES ($1, $2)
       RETURNING id, name, color`,
      [name, color]
    );

    const newUser = result.rows[0];

    console.log("New user:", newUser);

    // Seleciona automaticamente o utilizador recém-criado
    res.cookie('userId', newUser.id, { httpOnly: true, sameSite: 'lax' });

    res.redirect("/");
  } catch (error) {
    console.error("Error creating user:", error);

    res.render("new.ejs", {
      error: "The user already exists, try again.",
    });
  }
});



app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
});
