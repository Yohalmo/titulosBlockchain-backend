import express from "express";
import cors from "cors";
import { Blockchain } from "./blockchain/Blockchain.js";
import { AcademicTitle } from "./models/AcademicTitle.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const blockchain = new Blockchain(4, "0");

app.get("/api/blocks", (req, res) => {
    res.json(blockchain.blockChain);
});

app.get("/api/blocks/:id", (req, res) => {
    const id = Number(req.params.id);
    const block = blockchain.blockChain.find((b) => b.id === id);

    if (!block) {
        return res.status(404).json({ error: "Bloque no encontrado" });
    }

    res.json(block);
});

app.get("/api/titulos", (req, res) => {
    res.json(blockchain.getAllTitles());
});

app.get("/api/titulos/:codigo", (req, res) => {
    const result = blockchain.findTitle(req.params.codigo);

    if (!result) {
        return res.status(404).json({
            error: "Título no encontrado"
        });
    }

    res.json(result);
});

app.post("/api/titulos", (req, res) => {
    const {
        codigo,
        titular,
        titulo,
        institucion,
        fechaInicio,
        fechaFin,
        fechaEmision,
        descripcion
    } = req.body;

    const required = {
        codigo,
        titular,
        titulo,
        institucion,
        fechaInicio,
        fechaFin,
        fechaEmision
    };

    const missing = Object.entries(required)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        return res.status(400).json({
            error: "Faltan campos obligatorios",
            fields: missing
        });
    }

    if (blockchain.findTitle(codigo)) {
        return res.status(409).json({
            error: "Ya existe un título con ese código"
        });
    }

    const academicTitle = new AcademicTitle({
        codigo,
        titular,
        titulo,
        institucion,
        fechaInicio,
        fechaFin,
        fechaEmision,
        descripcion
    });

    const block = blockchain.addTitle(academicTitle);

    res.status(201).json({
        message: "Título registrado correctamente",
        blockId: block.id,
        hash: block.hash,
        previousHash: block.previousHash,
        nonce: block.nonce,
        title: academicTitle
    });
});

app.get("/api/verify", (req, res) => {
    res.json(blockchain.isValid());
});

app.get("/api", (req, res) => {
    res.json({
        name: "Blockchain de Títulos Académicos",
        version: "1.0.0",
        endpoints: [
            "GET /api/blocks",
            "GET /api/titulos",
            "GET /api/titulos/:codigo",
            "POST /api/titulos",
            "GET /api/verify"
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Backend ejecutándose en http://localhost:${PORT}`);
});
