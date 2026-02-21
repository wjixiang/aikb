import { PicosComponent } from "../picosComponents";

describe('PICOS Component', () => {
    it('should render into proper context', async () => {
        const component = new PicosComponent()
        const renderResult = await component.render()
        console.log(renderResult.render())
    })
})