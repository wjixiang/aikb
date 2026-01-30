import { tdiv } from './TUI_elements'

describe(tdiv, () => {
    it('should render into frame', () => {
        const elm = new tdiv({
            content: "test_content",
            styles: {
                width: 100,
                height: 0,
                showBorder: true
            }
        })

        console.log(elm.render())
    })

    it.todo('should able to nest elements')
})