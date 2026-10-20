import express from "express";
import cors from "cors";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { spawn } from 'child_process';
import { Blockchain } from "./blockchain/Blockchain.js";
import { AcademicTitle } from "./models/AcademicTitle.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
let PEERS = (process.env.PEERS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PEER_TOKEN = process.env.PEER_TOKEN ?? 'cambiar-este-token-antes-de-usar-en-red';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: '*' }));
app.use(express.json());

const blockchain = new Blockchain(4, "0", PORT);
const peerHeaders = { 'Content-Type': 'application/json', 'x-peer-token': PEER_TOKEN };
const activeChildNodes = new Map();

io.on('connection', (socket) => {
    socket.emit('connected', { port: PORT, peers: PEERS });
});

function notifyChainUpdate() {
    io.emit('chain_updated', {
        port: PORT,
        blocks: blockchain.blockChain,
        titles: blockchain.getAllTitles()
    });
}

function notifyNodeLaunched(newNodeUrl) {
    io.emit('node_launched', {
        launchedUrl: newNodeUrl,
        peers: PEERS
    });
}

// --- Endpoints para Wallets y Saldos ---

app.get("/api/wallets", (_req, res) => {
    res.json(blockchain.getAllWallets());
});

app.get("/api/wallets/:walletId", (req, res) => {
    const { walletId } = req.params;
    const balance = blockchain.getBalance(walletId);
    const wallets = blockchain.getAllWallets();
    const walletInfo = wallets.find(w => w.walletId === walletId);

    if (!walletInfo) {
        return res.status(404).json({ error: "Wallet no encontrada" });
    }

    res.json({
        ...walletInfo,
        balance
    });
});

app.post("/api/wallets/create", (req, res) => {
    const { walletId, userName, initialBalance } = req.body;
    if (!walletId || !userName || initialBalance === undefined) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const block = blockchain.createWalletAccount(walletId, userName, Number(initialBalance));
    notifyChainUpdate();
    void synchronizePeers();

    res.status(201).json({
        message: "Wallet creada e inicializada en Blockchain",
        walletId,
        userName,
        balance: blockchain.getBalance(walletId),
        blockId: block.id
    });
});

// --- Endpoints para Títulos y Revisiones ---

app.get("/api/blocks", (_req, res) => res.json(blockchain.blockChain));
app.get("/api/titulos", (_req, res) => res.json(blockchain.getAllTitles()));

app.post("/api/titulos", (req, res) => {
    const {
        codigo, titular, titulo, institucion, fechaInicio, fechaFin, fechaEmision, descripcion, walletId
    } = req.body;

    if (!walletId) return res.status(400).json({ error: "Se requiere un walletId emisor" });

    const required = { codigo, titular, titulo, institucion, fechaInicio, fechaFin, fechaEmision };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) return res.status(400).json({ error: "Faltan campos obligatorios", fields: missing });

    if (blockchain.findTitle(codigo)) return res.status(409).json({ error: "Ya existe un título con ese código" });

    try {
        const academicTitle = new AcademicTitle({
            codigo, titular, titulo, institucion, fechaInicio, fechaFin, fechaEmision, descripcion
        });

        const block = blockchain.addTitle(academicTitle, walletId, 10);

        notifyChainUpdate();
        void synchronizePeers();

        res.status(201).json({
            message: "Título registrado correctamente (-$10.00)",
            blockId: block.id,
            newBalance: blockchain.getBalance(walletId),
            title: academicTitle
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post("/api/titulos/review", (req, res) => {
    const { titleCode, senderWalletId, receiverWalletId } = req.body;
    if (!titleCode || !senderWalletId || !receiverWalletId) {
        return res.status(400).json({ error: "Faltan parámetros de la revisión" });
    }

    try {
        const block = blockchain.addTitleReview(titleCode, senderWalletId, receiverWalletId, 15);
        notifyChainUpdate();
        void synchronizePeers();

        res.status(200).json({
            message: "Título enviado a revisión correctamente (-$15.00 al emisor, +$15.00 al revisor)",
            blockId: block.id,
            newBalance: blockchain.getBalance(senderWalletId)
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/api/verify", (_req, res) => res.json(blockchain.isValid()));
app.get('/api/nodes', (_req, res) => res.json({ currentNode: PORT, peers: PEERS, launchedNodes: Array.from(activeChildNodes.keys()) }));

app.post('/api/peers/register', (req, res) => {
    const { peerUrl } = req.body ?? {};
    if (peerUrl && !PEERS.includes(peerUrl) && peerUrl !== `http://localhost:${PORT}`) {
        PEERS.push(peerUrl);
        notifyNodeLaunched(peerUrl);
        setTimeout(() => void synchronizePeers(), 100);
    }
    res.json({ port: PORT, peers: PEERS });
});

app.get('/api/peer/chain', (req, res) => {
    if (req.get('x-peer-token') !== PEER_TOKEN) return res.status(401).json({ error: 'Peer no autorizado' });
    res.json(blockchain.blockChain);
});

app.post('/api/peer/chain', (req, res) => {
    if (req.get('x-peer-token') !== PEER_TOKEN) return res.status(401).json({ error: 'Peer no autorizado' });
    const result = blockchain.replaceChain(req.body);
    if (result.valid) {
        notifyChainUpdate();
        setTimeout(() => void synchronizePeers(), 100);
    }
    res.status(result.valid ? 200 : 409).json(result);
});

app.post('/api/nodes/launch', async (req, res) => {
    const targetPort = Number(req.body?.port);
    if (!targetPort || targetPort === PORT) return res.status(400).json({ error: 'Puerto no válido' });
    if (activeChildNodes.has(targetPort)) return res.status(409).json({ error: `El nodo en ${targetPort} ya está activo.` });

    const newPeerUrl = `http://localhost:${targetPort}`;
    if (!PEERS.includes(newPeerUrl)) PEERS.push(newPeerUrl);

    const allPeers = [`http://localhost:${PORT}`, ...PEERS.filter(p => p !== newPeerUrl)].join(',');
    const entryPoint = process.argv[1];

    const child = spawn(process.execPath, [entryPoint], {
        env: { ...process.env, PORT: String(targetPort), PEERS: allPeers, PEER_TOKEN: PEER_TOKEN },
        stdio: 'inherit'
    });

    activeChildNodes.set(targetPort, child);
    child.on('exit', () => activeChildNodes.delete(targetPort));

    for (const peer of PEERS) {
        if (peer !== newPeerUrl) {
            try {
                await fetch(`${peer.replace(/\/$/, '')}/api/peers/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ peerUrl: newPeerUrl }),
                    signal: AbortSignal.timeout(2000)
                });
            } catch { }
        }
    }

    notifyNodeLaunched(newPeerUrl);
    void synchronizePeers();

    res.status(201).json({ message: `Servidor iniciado en puerto ${targetPort}`, port: targetPort, url: newPeerUrl });
});

// --- Endpoint para Detener / Eliminar Servidores ---
app.post('/api/nodes/stop', (req, res) => {
    const targetPort = Number(req.body?.port);

    if (!targetPort) {
        return res.status(400).json({ error: "Número de puerto requerido" });
    }

    if (targetPort === PORT) {
        return res.status(400).json({ error: "No se puede detener el nodo orquestador principal desde sí mismo." });
    }

    // 1. Finalizar el proceso si fue lanzado por este orquestador
    if (activeChildNodes.has(targetPort)) {
        const childProcess = activeChildNodes.get(targetPort);
        childProcess.kill('SIGTERM');
        activeChildNodes.delete(targetPort);
    }

    // 2. Remover el puerto de la lista de PEERS conocidos
    const targetUrl = `http://localhost:${targetPort}`;
    PEERS = PEERS.filter(p => p !== targetUrl);

    // 3. Notificar a todas las wallets vía WebSockets
    io.emit('node_stopped', { stoppedPort: targetPort, stoppedUrl: targetUrl, peers: PEERS });

    console.log(`[Orquestador] Servidor en el puerto ${targetPort} detenido.`);

    res.json({
        message: `Servidor en el puerto ${targetPort} detenido correctamente.`,
        port: targetPort,
        peers: PEERS
    });
});

let syncing = false;
async function synchronizePeers() {
    if (syncing) return;
    syncing = true;
    try {
        for (const peer of PEERS) {
            try {
                const response = await fetch(`${peer.replace(/\/$/, '')}/api/peer/chain`, { headers: peerHeaders, signal: AbortSignal.timeout(3000) });
                if (!response.ok) continue;
                const remote = await response.json();
                if (remote.length > blockchain.blockChain.length) {
                    const result = blockchain.replaceChain(remote);
                    if (result.valid) notifyChainUpdate();
                } else if (blockchain.blockChain.length > remote.length) {
                    await fetch(`${peer.replace(/\/$/, '')}/api/peer/chain`, {
                        method: 'POST',
                        headers: peerHeaders,
                        body: JSON.stringify(blockchain.blockChain),
                        signal: AbortSignal.timeout(3000)
                    });
                }
            } catch { }
        }
    } finally {
        syncing = false;
    }
}

httpServer.listen(PORT, HOST, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
    void synchronizePeers();
});

setInterval(() => void synchronizePeers(), 5000).unref();