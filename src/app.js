import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import joi from "joi";
dotenv.config();

const app = express();
const PORT = 5000;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db();
}).catch((err) => console.log(err.message));

app.use(cors());
app.use(express.json());

app.listen(PORT, () => console.log(`Servidor funcionando na porta ${PORT}`));

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const userSchema = joi.object({
        name: joi.string().required().min(4)
    });

    const validation = userSchema.validate(req.body);

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    const user = await db.collection("users").findOne({ name: name });

    if (!user) {
        await db.collection("users").insertOne({ name: name, lastStatus: Date.now() });

        const newUser = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        };

        await db.collection("messages").insertOne(newUser);
        return res.status(201).send("Usuário cadastrado com sucesso");
    }
    return res.status(409).send("Este usuário já está cadastrado.");
});
app.get("/participants", async (req, res) => {
    const users = await db.collection("users").find().toArray();
    res.send(users); 
});

app.post("/messages", (req, res) => {

});
app.get("/messages", (req, res) => {

});

app.post("/status", (req, res) => {

});