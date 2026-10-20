export class Transaction {
    constructor(id, type, data, senderWalletId = null, receiverWalletId = null, amount = 0) {
        this.id = id;
        this.timeStamp = Date.now();
        this.type = type; // "INITIAL_BALANCE", "ACADEMIC_TITLE", "TITLE_REVIEW"
        this.data = data;
        this.senderWalletId = senderWalletId;
        this.receiverWalletId = receiverWalletId;
        this.amount = amount;
    }

    toString() {
        return JSON.stringify({
            id: this.id,
            timeStamp: this.timeStamp,
            type: this.type,
            data: this.data,
            senderWalletId: this.senderWalletId,
            receiverWalletId: this.receiverWalletId,
            amount: this.amount
        });
    }
}