import { KmsWorkspace } from '../KmsWorkspace'

describe(KmsWorkspace, () => {
    it.skip('should render into context correctly', async () => {
        const workspace = new KmsWorkspace()
        const result = await workspace.render()
        console.log(result)
    })
})