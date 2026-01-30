import { prettifyCodeContext } from './componentUtils'

describe('utils', () => {
    it(prettifyCodeContext, () => {
        console.log(prettifyCodeContext(`export function prettifyCodeContext(codeContext: string) {
    const lines = codeContext.split('\n')
    const lineNum = lines.length
    const numSpace = String(lineNum).length
} `))
    })
})