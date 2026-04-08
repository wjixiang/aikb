import { config } from 'dotenv'
import { PubmedMirror } from "../lib/pubmed-mirror.js";
config()

async function main() {
    const year = process.argv[2];
    const res = await PubmedMirror.syncUpdate(year)
    console.log(res)
}

main()
