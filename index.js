import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();

// TODO: render.com provides the PORT and HOST environment variables,
// so we need to use those instead of hardcoding them
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

//  TODO: For local development, you can uncomment the lines
//  below and comment out the lines above
//const PORT = process.env.PORT || 3000;
//const HOST = process.env.HOST || 'localhost';



const db = new pg.Client(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.PGUSER || "postgres",
        host: process.env.PGHOST || "localhost",
        database: process.env.PGDATABASE || "permalist",
        password: process.env.PGPASSWORD,
        port: Number(process.env.PGPORT || 5432)
      }
);

try {
  await db.connect();
  console.log("Database connected");
} catch (error) {
  console.error("Database connection failed:", error);
  process.exit(1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;
let users = [];

async function checkTasksDay() {
  const resultDay = await db.query( 
    'SELECT day.id ,title FROM day JOIN users ON users.id = id_user WHERE id_user = $1', 
    [currentUserId]
   );  
  return resultDay.rows;
}

async function checkTasksWeek() {
   const resultWeek = await db.query( 
    'SELECT weeks.id ,title FROM weeks JOIN users ON users.id = id_user WHERE id_user = $1', 
    [currentUserId] ); 
  return resultWeek.rows;
}

async function checkTasksMonths() {
   const resultMonth = await db.query( 
    'SELECT months.id ,title FROM months JOIN users ON users.id = id_user WHERE id_user = $1', 
    [currentUserId] ); 
  return resultMonth.rows;
}

async function getCurrentUsers() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  const found = users.find((user) => user.id == currentUserId);
  if (!found) {
    currentUserId = users[0]?.id; // fall back to first user
    return users[0];
  }
  return found;
}


const VALID_TABLES = ['day', 'weeks', 'months'];

function validateTable(name) {
  if (!VALID_TABLES.includes(name)) throw new Error(`Invalid table: ${name}`);
  return name;
}

 function addItemToDatabase(tableName, item, date, currentUserId) {
      validateTable(tableName);
      return db.query(
        `INSERT INTO ${tableName} (title, date, id_user) VALUES ($1, $2, $3)`, 
        [item, date, currentUserId]
      );
    }

  function deleteItemFromDatabase(tableName, id) {
      validateTable(tableName);
      return db.query(
        `DELETE FROM ${tableName} WHERE id = $1`, 
        [id]
      );
    } 

  function updateItemInDatabase(tableName, item, date, id) {
      validateTable(tableName);
      return db.query(
        `UPDATE ${tableName} SET title = $1, date = $2 WHERE id = $3`, 
        [item, date, id]
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
  }else {
    const parsed = req.body.add ? parseInt(req.body.add) : null;
    if (!isNaN(parsed)) {
      currentUserId = parsed;
    }
    res.redirect("/");
  }  
});


app.get("/", async (req, res) => {
  try {
    const dayResult =  await checkTasksDay();
    const weekResult = await checkTasksWeek();
    const monthResult = await checkTasksMonths();
    const currentUser = await getCurrentUsers();
   
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
      let tableName = '';
      let item = '';
    if (list === 'Day' && itemDay) {
      tableName = 'day';
      item = itemDay;
      await addItemToDatabase(tableName, item, date, currentUserId);
    } else if (list === 'Week' && itemWeek) {
      tableName = 'weeks';
      item = itemWeek;
      await addItemToDatabase(tableName, item, date, currentUserId);
    } else if (list === 'Month' && itemMonth) {
      tableName = 'months';
      item = itemMonth;
      await addItemToDatabase(tableName, item, date, currentUserId);
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

    let tableName = '';
    let item = '';
    let id = '';

    if (list === 'Day' && updatedItemIdDay) {
      tableName = 'day';
      item = updatedItemTitleDay;
      id = updatedItemIdDay;
      await updateItemInDatabase(tableName, item, date, id);
    } else if (list === 'Week' && updatedItemIdWeek) {
      tableName = 'weeks';
      item = updatedItemTitleWeek;  
      id = updatedItemIdWeek;
      await updateItemInDatabase(tableName, item, date, id);
    } else if (list === 'Month' && updatedItemIdMonth) {
      tableName = 'months';
      item = updatedItemTitleMonth;
      id = updatedItemIdMonth;
      await updateItemInDatabase(tableName, item, date, id);
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
    let tableName = '';
    let id = '';

    if (list === 'Day' && idDay) {
      tableName = 'day';
      id = idDay;
      await deleteItemFromDatabase(tableName, id);
    } else if (list === 'Week'  && idWeek) {
      tableName = 'weeks';
      id = idWeek;
      await deleteItemFromDatabase(tableName, id);
    } else if (list === 'Month' && idMonth) {
      tableName = 'months';
      id = idMonth;
      await deleteItemFromDatabase(tableName, id);
    }
    res.redirect("/");
  }catch (error) {
    console.error("Error deleting item from the database:", error);
    res.status(500).send("Internal Server Error");
  }
});
  
app.post("/new", async (req, res) => {
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
    currentUserId = newUser.id;

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
