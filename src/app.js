import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
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

app.post("/participants", (req, res) => {
    const { name } = req.body;

    if (name.length === 0) {
        return res.sendStatus(422);
    }

    db.collection("users").findOne({ name: name }).then((user) => {
        if (!user) {
            db.collection("users").insertOne({ name: name, lastStatus: Date.now() }).then((sucess) => {
                const newUser = {
                    from: name,
                    to: 'Todos',
                    text: 'entra na sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                };

                db.collection("messages").insertOne(newUser).then((sucess) => {
                    res.status(201).send("Usuário cadastrado com sucesso");
                }).catch((error) => {
                    res.status(500).send(error.message)
                });
            }).catch((error) => {
                res.status(500).send(error.message)
            });

        } else {
            return res.status(409).send("Este usuário já está cadastrado.");
        }
    }).catch((error) => {
        return res.status(500).send(error.message)
    });
});
app.get("/participants", (req, res) => {

});

app.post("/messages", (req, res) => {

});
app.get("/messages", (req, res) => {

});

app.post("/status", (req, res) => {

});