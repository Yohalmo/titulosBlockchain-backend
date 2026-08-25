import fs from "fs";
import path from "path";
import { Block } from "../models/Block.js";
import { generateHash } from "../utils/sha256.js";

const DATA_DIR = path.resolve("data");
const DATA_FILE = path.join(DATA_DIR, "blockchain.json");

export class Blockchain {
  constructor(complexity = 4, proofChar = "0") {
    this.blockChain = [];
    this.complexity = complexity;
    this.proofOfWork = proofChar.repeat(complexity);
    this.load();

    if (this.blockChain.length === 0) {
      this.createGenesis();
    }
  }

  createGenesis() {
    const block = new Block(
      0,
      "0".repeat(64)
    );
    this.mineBlock(block);
    this.blockChain.push(block);
    this.save();
  }

  getLastBlock() {
    return this.blockChain[this.blockChain.length - 1];
  }

  createBlock() {
    const previousHash = this.getLastBlock().hash;
    return new Block(this.blockChain.length, previousHash);
  }

  addTitle(title) {
    const block = this.createBlock();
    block.addTitle(title);
    this.mineBlock(block);
    this.blockChain.push(block);
    this.save();
    return block;
  }

  mineBlock(block) {
    let nonce = 0;
    let hash = "";

    do {
      hash = block.calculateHash(nonce);
      nonce++;
    } while (!hash.startsWith(this.proofOfWork));

    block.register(nonce - 1, hash);
  }

  verifyProofOfWork(block) {
    if (!block.hash || block.nonce < 0) return false;

    const calculated = generateHash(
      block.toString() + String(block.nonce)
    );

    return (
      calculated === block.hash &&
      block.hash.startsWith(this.proofOfWork)
    );
  }

  isValid() {
    for (let i = 0; i < this.blockChain.length; i++) {
      const current = this.blockChain[i];

      if (!this.verifyProofOfWork(current)) {
        return {
          valid: false,
          block: current.id,
          reason: "Proof of Work o hash inválido"
        };
      }

      if (i > 0) {
        const previous = this.blockChain[i - 1];

        if (current.previousHash !== previous.hash) {
          return {
            valid: false,
            block: current.id,
            reason: "previousHash no coincide con el bloque anterior"
          };
        }
      }
    }

    return { valid: true, message: "Blockchain íntegra" };
  }

  findTitle(codigo) {
    for (const block of this.blockChain) {
      for (const tx of block.transactions) {
        if (tx.data?.codigo === codigo) {
          return {
            block,
            transaction: tx
          };
        }
      }
    }
    return null;
  }

  getAllTitles() {
    const result = [];

    for (const block of this.blockChain) {
      for (const transaction of block.transactions) {
        result.push({
          blockId: block.id,
          blockHash: block.hash,
          transaction
        });
      }
    }

    return result;
  }

  save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(this.blockChain, null, 2),
      "utf8"
    );
  }

  load() {
    if (!fs.existsSync(DATA_FILE)) return;

    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    this.blockChain = raw.map((item) => {
      const block = new Block(item.id, item.previousHash);
      block.timeStamp = item.timeStamp;
      block.transactions = item.transactions ?? [];
      block.nonce = item.nonce;
      block.hash = item.hash;
      return block;
    });
  }
}
