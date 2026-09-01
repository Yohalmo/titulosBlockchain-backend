export class Transaction {
    constructor(id, title) {
        this.id = id;
        this.timeStamp = Date.now();
        this.type = "ACADEMIC_TITLE";
        this.data = title;
    }

    toString() {
        return JSON.stringify({
            id: this.id,
            timeStamp: this.timeStamp,
            type: this.type,
            data: this.data
        });
    }
}
