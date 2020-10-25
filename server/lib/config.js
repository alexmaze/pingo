const path = require("path")

class Config {

    constructor() {
        this.port = 0
        this.mongo_host = ""
        this.mongo_port = 0
        this.mongo_user = ""
        this.mongo_password = ""

        this.load()
    }

    load() {
        let configName = "config.dev.json"
        if (process.env.NODE_ENV === "production") {
            configName = "config.prod.json"
        }

        const p = path.join(__dirname, "../", configName)
        const c = require(p)
        this.port = c.port
        this.mongo_host = c.mongo_host
        this.mongo_port = c.mongo_port
        this.mongo_user = c.mongo_user
        this.mongo_password = c.mongo_password
    }
}

module.exports = new Config()