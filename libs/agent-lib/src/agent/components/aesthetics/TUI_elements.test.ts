import { tdiv } from './TUI_elements'

describe(tdiv, () => {
    it('should render into frame', () => {
        const elm = new tdiv({
            width: 100,
            height: 0,
            content: "test_content",
            border: true
        })

        console.log(elm.render())
    })

    it.todo('should able to nest elements')
})