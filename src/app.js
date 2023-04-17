import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import joi from "joi";
import iconv from "iconv-lite";
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

// const headerMiddleware = (req, res, next) => {
//     const content = req.headers.user;
//     if (content) {
//         const decoded = iconv.decode(Buffer.from(content, 'binary'), 'utf-8');
//         req.headers.user = decoded;
//     }
//     next();
// }
// app.use(headerMiddleware);

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

    try {
        const user = await db.collection("participants").findOne({ name: name });
        if (!user && name !== "Todos") {
            await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() });

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
    } catch (err) {
        res.status(500).send(err.message)
    }
    return res.status(409).send("Este usuário já está cadastrado.");
});
app.get("/participants", async (req, res) => {
    try {
        const users = await db.collection("participants").find().toArray();
        res.send(users);
    } catch (err) {
        res.status(500).send(err.message)
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    const objectMessage = { from, to, text, type };
    const newMessage = { ...objectMessage, time: dayjs().format('HH:mm:ss') };

    const messagesSchema = joi.object({
        from: joi.string().required().min(4),
        to: joi.string().required().min(4),
        text: joi.string().required(),
        type: joi.string().required().min(7)
    });

    const validation = messagesSchema.validate(objectMessage, { abortEarly: false });
    if (validation.error) return res.status(422).send(validation.error);

    try {
        const userTo = await db.collection("participants").findOne({ name: to });
        if (!userTo && to !== "Todos") return res.status(422).send("O usuário não está online");

        const userFrom = await db.collection("participants").findOne({ name: from });
        if (!userFrom) return res.status(422).send("Você está deslogado");

        if (type !== "message" && type !== "private_message") return res.sendStatus(422);
        if (userTo) {
            if (userTo.name === userFrom.name) return res.status(422).send("Você não pode enviar uma mensagem para si mesmo");
        }

        db.collection("messages").insertOne(newMessage);
        return res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message)
    }
});
app.get("/messages", async (req, res) => {
    const from = req.headers.user;
    const { limit } = req.query;

    const limitSchema = joi.object({
        limit: joi.number().integer().positive()
    });
    const validation = limitSchema.validate(req.query);
    if (validation.error) return res.sendStatus(422);

    try {
        const messages = await db.collection("messages").find(
            ({ $or: [{ from: from }, { to: from }, { to: "Todos" }, { type: "message" }] })
        ).toArray();

        if (limit) return res.send(messages.slice(-limit));

        return res.send(messages);
    } catch (err) {
        res.status(500).send(err.message)
    }
});
app.get("/messages/:id", async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;

    const deleteMessage = await db.collection("messages").findOne({_id: new ObjectId(id)});
    if(!deleteMessage) return res.sendStatus(404);
    if(deleteMessage.from!==user) return res.sendStatus(401);
    
    // const messageUser = await db.collection("messages").findOne({from: user});
    // if(!messageUser) return res.status(404).send("Você não está logado");

    await db.collection("messages").deleteOne({_id: new ObjectId(id)});
    res.send("Mensagem apagada com sucesso");
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
        const userLogin = await db.collection("participants").findOne({ name: user });
        if (!userLogin) return res.sendStatus(404);

        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        return res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message)
    }
});

setInterval(async () => {
    const users = await db.collection("participants").find().toArray();

    const usersOff = [];
    users.filter(u => {
        if ((Date.now() - u.lastStatus) > 10000) {
            usersOff.push(u.name);
            return;
        }
    })
    try {
        await db.collection("participants").deleteMany({ name: { $in: usersOff } });
        usersOff.map(async (name) => {
            await db.collection("messages").insertOne(
                {
                    from: name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                });
        });
    } catch (err) {
        res.status(500).send(err.message)
    }
}, 15000);