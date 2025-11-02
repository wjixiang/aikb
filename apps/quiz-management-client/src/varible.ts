import { readFileSync } from "fs"
export const quesiton = readFileSync("./src/quiz_data/quiz.md").toString()
