import { config } from 'dotenv'
import { PubmedMirror } from "../lib/pubmed-mirror.js";
config()

async function main() {
    const res = await PubmedMirror.sync()
    console.log(res)
}

main()