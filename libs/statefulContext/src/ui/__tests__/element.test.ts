import { tdiv } from "../tdiv"
import { tp } from "../text/tp"

describe(tdiv, () => {
    it('should render into context', () => {
        const elm = new tdiv({
            content: 'test_content',
            styles: {
                // width: 100,
                // height: 0,
                showBorder: true
            }
        })
        console.log(elm.render())
    })

    it.only('should nest elements', () => {
        const elm1 = new tdiv({
            content: 'test_content' + 'abc'.repeat(100),
            styles: {
                width: 100,
                // height: 0,
                showBorder: true
            }
        })

        const elm2 = new tdiv({
            content: 'nested_content',
            styles: {
                // width: 100,
                // height: 0,
                showBorder: true
            }
        })

        elm1.addChild(elm2)
        const renderResult = elm1.render()
        console.debug(renderResult)
        expect(renderResult).include('nested_content')
    })

    it.only('should fill width of parent element', () => {
        const elm1 = new tp({
            content: 'test_content' + 'abc'.repeat(100),
            styles: {
                width: 100,
                // height: 0,
                showBorder: true
            }
        })

        const elm2 = new tdiv({
            content: 'nested_content',
            styles: {
                // width: 100,
                // height: 0,
                showBorder: true
            }
        })

        elm2.addChild(elm1)

        console.log(elm2.render())
    })
})