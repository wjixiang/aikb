import { tdiv } from "../tdiv"

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

    it('should nest elements', () => {
        const elm1 = new tdiv({
            content: 'test_content' + 'abc'.repeat(100),
            styles: {
                width: 100,
                // height: 0,
                showBorder: true
            }
        })

        const elm2 = new tdiv({
            content: 'test_content',
            styles: {
                // width: 100,
                // height: 0,
                showBorder: true
            }
        })

        elm1.addChild(elm2)
        console.log(elm1.render())
    })
})