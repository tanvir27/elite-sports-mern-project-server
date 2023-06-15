const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

//middle ware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("Running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hxmdm1d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const classesCollections = client
      .db("summerCampSchool")
      .collection("classes");
    const bookedClassCollections = client
      .db("summerCampSchool")
      .collection("bookedClass");
    const enrolledClassCollections = client
      .db("summerCampSchool")
      .collection("enrolledClasses");
    const usersCollections = client.db("summerCampSchool").collection("users");
    const paymentCollections = client
      .db("summerCampSchool")
      .collection("payments");
    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //classes
    app.get("/classes", async (req, res) => {
      const query = { status: "Approved" };
      const result = await classesCollections.find(query).toArray();
      res.send(result);
    });
    app.post("/classes", verifyJWT, async (req, res) => {
      const data = req.body;
      const result = await classesCollections.insertOne(data);
      res.send(result);
    });
    app.get("/classes/allclasses", async (req, res) => {
      const result = await classesCollections.find().toArray();
      res.send(result);
    });
    app.patch("/classes/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updatedClass = {
        $set: {
          status: status,
        },
      };
      const result = await classesCollections.updateOne(filter, updatedClass);
      res.send(result);
    });
    app.patch("/classes/feedback/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;
      const query = { _id: new ObjectId(id) };

      const updatedClass = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classesCollections.updateOne(query, updatedClass);
      res.send(result);
    });
    app.get("/classes/myclasses/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { instructor_email: email };
      const result = await classesCollections.find(query).toArray();
      res.send(result);
    });
    //booked class
    app.post("/bookedclass", verifyJWT, async (req, res) => {
      const data = req.body.bookedClass;
      const email = data.user_email;
      const id = data.class_id;
      const query = {
        class_id: id,
        user_email: email,
      };
      const checkData = await bookedClassCollections.find(query).toArray();
      if (checkData.length > 0) {
        res.send("available");
      } else {
        const result = await bookedClassCollections.insertOne(data);
        res.send(result);
      }
    });
    app.delete("/bookedclass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { class_id: id };
      const result = await bookedClassCollections.deleteOne(query);
      res.send(result);
    });
    app.get("/bookedclass/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const result = await bookedClassCollections.find(query).toArray();
      res.send(result);
    });
    //payments

    //enrolled class api
    app.get("/enrollclass/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {
        user_email: email,
      };
      const result = await enrolledClassCollections.find(query).toArray();
      res.send(result);
    });

    //users
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollections.insertOne(user);
      res.send(result);
    });
    app.get("/users/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollections.find(query).toArray();
      res.send(result);
    });
    //admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email === email) {
        const query = { email: email };
        const user = await usersCollections.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.send(result);
      } else {
        res.send({ admin: false });
      }
    });
    //instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email === email) {
        const query = { email: email };
        const user = await usersCollections.findOne(query);
        const result = { instructor: user?.role === "instructor" };
        res.send(result);
      } else {
        res.send({ instructor: false });
      }
    });
    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollections.updateOne(filter, updatedUser);
      res.send(result);
    });
    app.patch("/users/instructor/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollections.updateOne(filter, updatedUser);
      if (result === null) {
        res.send("No user available");
      } else {
        res.send(result);
      }
    });
    //create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment related api
    app.get("/payments/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollections
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollections.insertOne(payment);
      // add to my class collection
      const myClassResult = await enrolledClassCollections.insertOne(
        payment.class
      );

      const find = { class_id: payment?.class_id };
      const query = { _id: new ObjectId(payment?.class_id) };
      //update enroll student and available seats
      const updatedClass = {
        $inc: {
          enroll_students: 1,
          available_seats: -1,
        },
      };

      const updateResult = await classesCollections.updateOne(
        query,
        updatedClass
      );
      // delete from booked
      const deleteResult = await bookedClassCollections.deleteOne(find);
      res.send({ result, myClassResult, updateResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`LIstening from port :${port}`);
});
