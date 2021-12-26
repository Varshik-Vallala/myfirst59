const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(process.env.PORT || 3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertStateDbObjToResponse = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

const convertDisObjToResponse = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};
// app.get("/users/", async (request, response) => {
//   const allUsersQuery = `SELECT * FROM state ;`;
//   const allUsers = await db.all(allUsersQuery);
//   response.send(allUsers);
// });
const checkToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  //   console.log(username + " " + password);
  const userQuery = `SELECT * FROM user WHERE username = '${username}';`;
  //   console.log(userQuery);
  const user = await db.get(userQuery);
  //   console.log(user);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", checkToken, async (request, response) => {
  const allStatesQuery = `SELECT * FROM state ;`;
  const allStates = await db.all(allStatesQuery);
  response.send(
    allStates.map((eachState) => convertStateDbObjToResponse(eachState))
  );
});

app.get("/states/:stateId/", checkToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const oneState = await db.get(stateQuery);
  response.send(convertStateDbObjToResponse(oneState));
});

app.post("/districts/", checkToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `INSERT INTO 
    district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}) ;`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", checkToken, async (request, response) => {
  const { districtId } = request.params;
  const selectDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const district = await db.get(selectDistrictQuery);
  response.send(convertDisObjToResponse(district));
});

app.delete("/districts/:districtId/", checkToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}; `;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/", checkToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
  UPDATE district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active}, 
    deaths = ${deaths}
  WHERE
    district_id = ${districtId}; `;
  console.log(updateDistrictQuery);
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", checkToken, async (request, response) => {
  const { stateId } = request.params;
  const statsQuery = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;
  const totalStats = await db.get(statsQuery);
  response.send(totalStats);
});

module.exports = app;
