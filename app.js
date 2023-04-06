const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const databasePath = path.join(__dirname, "twitterClone.db");
let database = null;

const initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is initialized and running at port number 3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

//API-1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getPreviousUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const getPreviousUserQueryResponse = await database.get(getPreviousUserQuery);
  if (getPreviousUserQueryResponse !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const encryptedPassword = await bcrypt.hash(password, 10);
      const registerNewUserQuery = `INSERT INTO user(username,password,name,gender) VALUES('${username}','${encryptedPassword}','${name}','${gender}');`;
      await database.run(registerNewUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API-2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getPreviousUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const getPreviousUserQueryResponse = await database.get(getPreviousUserQuery);
  if (getPreviousUserQueryResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordValid = await bcrypt.compare(
      password,
      getPreviousUserQueryResponse.password
    );
    if (isPasswordValid !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const jwtToken = jwt.sign(username, "asdfghjkl");
      response.status(200);
      response.send({ jwtToken });
    }
  }
});

//Authenticate User Function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload;
        next();
      }
    });
  }
};

//API-10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const date = new Date();
  const postUserTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time) VALUES('${tweet}',${user_id},'${date}');`;
  await database.run(postUserTweetQuery);
  response.status(200);
  response.send("Created a Tweet");
});

//API-11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const { user_id } = await database.get(getUserIdQuery);
    const deleteUserTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId} AND user_id=${user_id};`;
    const databaseResponse = await database.run(deleteUserTweetQuery);
    if (databaseResponse.changes === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.status(200);
      response.send("Tweet Removed");
    }
  }
);

//API-4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const userFollowingPeopleQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${user_id};`;
  const userFollowingPeopleQueryResponse = await database.all(
    userFollowingPeopleQuery
  );
  let responseList = [];
  for (let eachuser of userFollowingPeopleQueryResponse) {
    let getEachUserQuery = `SELECT name FROM user WHERE user_id=${eachuser.following_user_id};`;
    responseList.push(await database.get(getEachUserQuery));
  }
  response.status(200);
  response.send(responseList);
});

//API-5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  let getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const peopleFollowingUserQuery = `SELECT follower_user_id FROM follower WHERE following_user_id=${user_id};`;
  const peopleFollowingUserQueryResponse = await database.all(
    peopleFollowingUserQuery
  );
  let responseList = [];
  for (let eachuser of peopleFollowingUserQueryResponse) {
    let getEachUserQuery = `SELECT name FROM user WHERE user_id=${eachuser.follower_user_id};`;
    responseList.push(await database.get(getEachUserQuery));
  }
  response.status(200);
  response.send(responseList);
});

//API-9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT * FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id=${user_id};`;
  const tweetIds = await database.all(getTweetIdsQuery);
  let responseList = [];
  for (let eachtweet of tweetIds) {
    const getTweetQuery = `SELECT tweet FROM tweet WHERE tweet_id=${eachtweet.tweet_id};`;
    const { tweet } = await database.get(getTweetQuery);
    const tweetDateQuery = `SELECT date_time FROM tweet WHERE tweet_id=${eachtweet.tweet_id};`;
    const { date_time } = await database.get(tweetDateQuery);
    const replyCountQuery = `SELECT COUNT(*) FROM reply WHERE tweet_id=${eachtweet.tweet_id};`;
    const replies = await database.all(replyCountQuery);
    const tweet_replies = replies[0]["COUNT(*)"];
    const likeCountQuery = `SELECT COUNT(*) FROM like WHERE tweet_id=${eachtweet.tweet_id};`;
    const likes = await database.all(likeCountQuery);
    const tweet_likes = likes[0]["COUNT(*)"];
    let resultObject = {
      tweet: tweet,
      likes: tweet_likes,
      replies: tweet_replies,
      dateTime: date_time,
    };
    responseList.push(resultObject);
  }
  response.status(200);
  response.send(responseList);
});

//API-3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const userFollowingPeopleQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${user_id};`;
  const userFollowingPeopleQueryResponse = await database.all(
    userFollowingPeopleQuery
  );
  let tweetsUsersIds = [];
  for (let eachuser of userFollowingPeopleQueryResponse) {
    tweetsUsersIds.push(eachuser.following_user_id);
  }
  const tableName = username + "api3";
  const createTableQuery = `CREATE TABLE '${tableName}'(username TEXT,tweet TEXT,dateTime DATETIME);`;
  await database.run(createTableQuery);
  for (let eachitem of tweetsUsersIds) {
    const getUsernameQuery = `SELECT username FROM user WHERE user_id=${eachitem};`;
    const { username } = await database.get(getUsernameQuery);
    const getTweetsQuery = `SELECT username,tweet,date_time FROM user NATURAL JOIN tweet WHERE username='${username}';`;
    const result = await database.all(getTweetsQuery);
    for (let eachitem of result) {
      const putDataQuery = `INSERT INTO '${tableName}'(username,tweet,dateTime) VALUES('${eachitem.username}','${eachitem.tweet}','${eachitem.date_time}');`;
      await database.run(putDataQuery);
    }
  }
  const responseList = await database.all(
    `SELECT * FROM '${tableName}' ORDER BY dateTime DESC LIMIT 4 OFFSET 0;`
  );
  const result = responseList;
  await database.run(`DROP TABLE '${tableName}'`);
  response.send(result);
});

//API-6
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const { user_id } = await database.get(getUserIdQuery);
  const getUserFollowingPeopleQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${user_id};`;
  const getUserFollowingPeopleQueryResponse = await database.all(
    getUserFollowingPeopleQuery
  );
  let userFollowingPeopleIds = [];
  for (let eachitem of getUserFollowingPeopleQueryResponse) {
    userFollowingPeopleIds.push(eachitem.following_user_id);
  }
  const getUserFollowingPersonTweetQuery = `SELECT user_id,tweet,date_time FROM tweet WHERE tweet_id=${tweetId};`;
  const getUserFollowingPersonTweetQueryResponse = await database.get(
    getUserFollowingPersonTweetQuery
  );
  const getLikesCountQuery = `SELECT COUNT(*) FROM like WHERE tweet_id=${tweetId};`;
  const getLikesCountQueryResponse = await database.all(getLikesCountQuery);
  const getRepliesCountQuery = `SELECT COUNT(*) FROM reply WHERE tweet_id=${tweetId};`;
  const getRepliesCountQueryResponse = await database.all(getRepliesCountQuery);
  const isIdValid = userFollowingPeopleIds.includes(
    getUserFollowingPersonTweetQueryResponse.user_id
  );
  if (isIdValid) {
    let responseObject = {
      tweet: getUserFollowingPersonTweetQueryResponse.tweet,
      likes: getLikesCountQueryResponse[0]["COUNT(*)"],
      replies: getRepliesCountQueryResponse[0]["COUNT(*)"],
      dateTime: getUserFollowingPersonTweetQueryResponse.date_time,
    };
    response.status(200);
    response.send(responseObject);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API-7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    let userName = username;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const { user_id } = await database.get(getUserIdQuery);
    const getUserFollowingPeopleQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${user_id};`;
    const getUserFollowingPeopleQueryResponse = await database.all(
      getUserFollowingPeopleQuery
    );
    let userFollowingPeopleIds = [];
    for (let eachitem of getUserFollowingPeopleQueryResponse) {
      userFollowingPeopleIds.push(eachitem.following_user_id);
    }
    const getTweetPostedUserIdQuery = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const getTweetPostedUserIdQueryResponse = await database.get(
      getTweetPostedUserIdQuery
    );
    const isIdValid = userFollowingPeopleIds.includes(
      getTweetPostedUserIdQueryResponse.user_id
    );
    if (isIdValid) {
      const getUserLikesIdsQuery = `SELECT user_id FROM like WHERE tweet_id=${tweetId};`;
      const getUserLikesIdsResponse = await database.all(getUserLikesIdsQuery);
      let userNames = [];
      for (let eachuser of getUserLikesIdsResponse) {
        const getNameQuery = `SELECT username FROM user WHERE user_id=${eachuser.user_id};`;
        const { username } = await database.get(getNameQuery);
        userNames.push(username);
      }
      response.status(200);
      response.send({ likes: userNames });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API-8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let responseList = [];
    const { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const { user_id } = await database.get(getUserIdQuery);
    const getUserFollowingPeopleQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${user_id};`;
    const getUserFollowingPeopleQueryResponse = await database.all(
      getUserFollowingPeopleQuery
    );
    const getTweetPostedUserId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const getTweetPostedUserIdResponse = await database.get(
      getTweetPostedUserId
    );
    const userFollowingPeopleIds = [];
    for (let eachitem of getUserFollowingPeopleQueryResponse) {
      userFollowingPeopleIds.push(eachitem.following_user_id);
    }
    const isUserValid = userFollowingPeopleIds.includes(
      getTweetPostedUserIdResponse.user_id
    );
    if (isUserValid) {
      const getReplyDetailsQuery = `SELECT user_id,reply FROM reply WHERE tweet_id=${tweetId};`;
      const getReplyDetailsQueryResponse = await database.all(
        getReplyDetailsQuery
      );
      for (let eachitem of getReplyDetailsQueryResponse) {
        const getNameQuery = `SELECT name FROM user WHERE user_id=${eachitem.user_id};`;
        const { name } = await database.get(getNameQuery);
        let object = { name: name, reply: eachitem.reply };
        responseList.push(object);
      }
      response.status(200);
      response.send({ replies: responseList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;

/*
for (let eachuser of userFollowingPeopleQueryResponse) {
    const getUserNameQuery = `SELECT username FROM user WHERE user_id=${eachuser.following_user_id};`;
    const username = await database.get(getUserNameQuery);
    const getUserTweetAndDatetimeQuery = `SELECT tweet,date_time FROM tweet WHERE user_id=${eachuser.following_user_id} ORDER BY date_time DESC;`;
    const response = await database.all(getUserTweetAndDatetimeQuery);
    for (let eachitem of response) {
      let object = {
        username: username.username,
        tweet: eachitem.tweet,
        dateTime: eachitem.date_time,
      };
      responseList.push(object);
    }
  }
  response.status(200);
  response.send(responseList.splice(0, 4));
*/
