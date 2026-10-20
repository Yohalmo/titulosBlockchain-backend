import { Transaction } from "./Transaction.js";
import { generateHash } from "../utils/sha256.js";

export class Block {
  constructor(id, previousHash) {
    this.id = id;
    this.timeStamp = Date.now();
    this.previousHash = previousHash;
    this.transactions = [];
    this.nonce = -1;
    this.hash = null;
  }

  register(nonce, hash) {
    if (this.id > -1 && this.nonce < 0 && this.hash === null) {
      this.nonce = nonce;
      this.hash = hash;
      return true;
    }
    return false;
  }

  addTransaction(type, data, senderWalletId = null, receiverWalletId = null, amount = 0) {
    const transaction = new Transaction(
      this.transactions.length,
      type,
      data,
      senderWalletId,
      receiverWalletId,
      amount
    );
    this.transactions.push(transaction);
    return transaction;
  }

  toString() {
    return JSON.stringify({
      id: this.id,
      timeStamp: this.timeStamp,
      previousHash: this.previousHash,
      transactions: this.transactions
    });
  }

  calculateHash(nonce = this.nonce) {
    return generateHash(this.toString() + String(nonce));
  }
}