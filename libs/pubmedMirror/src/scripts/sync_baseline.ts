import { config } from 'dotenv'
import { syncAnnualPubmedIndexFiles } from "../lib/pubmed-mirror.js";
config()

async function main() {
    const res = await syncAnnualPubmedIndexFiles()
}

main()