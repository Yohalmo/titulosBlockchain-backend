import fs from "fs";
import path from "path";
import { Block } from "../models/Block.js";
import { generateHash } from "../utils/sha256.js";
import {
    decryptJson,
    encryptJson,
    isEncryptedPayload
} from "../utils/encryptedStorage.js";

const DATA_DIR = path.resolve("data");

export class Blockchain {
    #blockChain = [];
    #complexity;
    #proofOfWork;
    #port;

    constructor(complexity = 4, proofChar = "0", port = 3001) {
        this.#blockChain = [];
        this.#complexity = complexity;
        this.#proofOfWork = proofChar.repeat(complexity);
        this.#port = port;
        this.load();

        if (this.#blockChain.length === 0) {
            this.createGenesis();
        }
    }

    get blockChain() {
        return this.#blockChain;
    }

    get dataFile() {
        return path.join(DATA_DIR, `blockchain_${this.#port}.json`);
    }

    get tempFile() {
        return path.join(DATA_DIR, `blockchain_${this.#port}.json.tmp`);
    }

    createGenesis() {
        const block = new Block(0, "0".repeat(64));
        this.mineBlock(block);
        this.#blockChain.push(block);
        this.save();
    }

    getLastBlock() {
        return this.#blockChain[this.#blockChain.length - 1];
    }

    createBlock() {
        const previousHash = this.getLastBlock().hash;
        return new Block(this.#blockChain.length, previousHash);
    }

    // --- CÁLCULO DINÁMICO DEL SALDO DE UNA WALLET ---
    getBalance(walletId) {
        if (!walletId) return 0;
        let balance = 0;

        for (const block of this.#blockChain) {
            for (const tx of block.transactions) {
                // Fondeo Inicial
                if (tx.type === "INITIAL_BALANCE" && tx.receiverWalletId === walletId) {
                    balance += Number(tx.amount || 0);
                }
                // Cobro por Emisión de Título ($10)
                if (tx.type === "ACADEMIC_TITLE" && tx.senderWalletId === walletId) {
                    balance -= Number(tx.amount || 10);
                }
                // Envío a Revisión ($15)
                if (tx.type === "TITLE_REVIEW") {
                    if (tx.senderWalletId === walletId) {
                        balance -= Number(tx.amount || 15);
                    }
                    if (tx.receiverWalletId === walletId) {
                        balance += Number(tx.amount || 15);
                    }
                }
            }
        }
        return balance;
    }

    // Fondeo Inicial de la Wallet
    createWalletAccount(walletId, userName, initialBalance) {
        const block = this.createBlock();
        block.addTransaction("INITIAL_BALANCE", { userName }, null, walletId, Number(initialBalance));
        this.mineBlock(block);
        this.#blockChain.push(block);
        this.save();
        return block;
    }

    // Registro de Título ($10 de comisión)
    addTitle(title, senderWalletId, fee = 10) {
        const currentBalance = this.getBalance(senderWalletId);
        if (currentBalance < fee) {
            throw new Error(`Saldo insuficiente ($${currentBalance.toFixed(2)}). Se requieren $${fee.toFixed(2)}.`);
        }

        const block = this.createBlock();
        block.addTransaction("ACADEMIC_TITLE", title, senderWalletId, null, fee);
        this.mineBlock(block);
        this.#blockChain.push(block);
        this.save();
        return block;
    }

    // Envío a Revisión ($15 transferidos de emisor a revisor)
    addTitleReview(titleCode, senderWalletId, receiverWalletId, amount = 15) {
        const currentBalance = this.getBalance(senderWalletId);
        if (currentBalance < amount) {
            throw new Error(`Saldo insuficiente ($${currentBalance.toFixed(2)}). Se requieren $${amount.toFixed(2)} para enviar a revisión.`);
        }

        const block = this.createBlock();
        block.addTransaction("TITLE_REVIEW", { titleCode }, senderWalletId, receiverWalletId, amount);
        this.mineBlock(block);
        this.#blockChain.push(block);
        this.save();
        return block;
    }

    mineBlock(block) {
        let nonce = -1;
        let hash = "";

        do {
            nonce++;
            hash = block.calculateHash(nonce);
        } while (!hash.startsWith(this.#proofOfWork));

        block.register(nonce, hash);
    }

    verifyProofOfWork(block) {
        if (!block.hash || block.nonce < 0) return false;
        const calculated = generateHash(block.toString() + String(block.nonce));
        return calculated === block.hash && block.hash.startsWith(this.#proofOfWork);
    }

    isValid() {
        for (let i = 0; i < this.#blockChain.length; i++) {
            const current = this.#blockChain[i];
            if (!this.verifyProofOfWork(current)) {
                return { valid: false, block: current.id, reason: "Proof of Work o hash inválido" };
            }
            if (i > 0) {
                const previous = this.#blockChain[i - 1];
                if (current.previousHash !== previous.hash) {
                    return { valid: false, block: current.id, reason: "previousHash desalineado" };
                }
            }
        }
        return { valid: true, message: "Blockchain íntegra" };
    }

    findTitle(codigo) {
        for (const block of this.#blockChain) {
            for (const tx of block.transactions) {
                if (tx.type === "ACADEMIC_TITLE" && tx.data?.codigo === codigo) {
                    return { block, transaction: tx };
                }
            }
        }
        return null;
    }

    getAllTitles() {
        const result = [];
        for (const block of this.#blockChain) {
            for (const tx of block.transactions) {
                if (tx.type === "ACADEMIC_TITLE") {
                    result.push({
                        blockId: block.id,
                        blockHash: block.hash,
                        transaction: tx
                    });
                }
            }
        }
        return result;
    }

    getAllWallets() {
        const walletsMap = new Map();
        for (const block of this.#blockChain) {
            for (const tx of block.transactions) {
                if (tx.type === "INITIAL_BALANCE" && tx.receiverWalletId) {
                    walletsMap.set(tx.receiverWalletId, {
                        walletId: tx.receiverWalletId,
                        userName: tx.data?.userName || "Usuario",
                        balance: this.getBalance(tx.receiverWalletId)
                    });
                }
            }
        }
        return Array.from(walletsMap.values());
    }

    replaceChain(newChain) {
        if (!Array.isArray(newChain)) return { valid: false, reason: "Cadena no válida" };
        if (newChain.length <= this.#blockChain.length) return { valid: false, reason: "Cadena no más larga" };

        const hydratedChain = newChain.map((item) => {
            const block = new Block(item.id, item.previousHash);
            block.timeStamp = item.timeStamp;
            block.transactions = item.transactions ?? [];
            block.nonce = item.nonce;
            block.hash = item.hash;
            return block;
        });

        this.#blockChain = hydratedChain;
        this.save();
        return { valid: true, message: "Cadena actualizada correctamente" };
    }

    save() {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const encryptedPayload = encryptJson(this.#blockChain);
        fs.writeFileSync(this.tempFile, JSON.stringify(encryptedPayload, null, 2), { encoding: "utf8", mode: 0o600 });
        fs.renameSync(this.tempFile, this.dataFile);
    }

    load() {
        if (!fs.existsSync(this.dataFile)) return;
        try {
            const storedPayload = JSON.parse(fs.readFileSync(this.dataFile, "utf8"));
            const raw = isEncryptedPayload(storedPayload) ? decryptJson(storedPayload) : storedPayload;
            if (!Array.isArray(raw)) return;

            this.#blockChain = raw.map((item) => {
                const block = new Block(item.id, item.previousHash);
                block.timeStamp = item.timeStamp;
                block.transactions = item.transactions ?? [];
                block.nonce = item.nonce;
                block.hash = item.hash;
                return block;
            });
        } catch {
            this.#blockChain = [];
        }
    }
}