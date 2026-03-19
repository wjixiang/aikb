import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
    afterEach,
} from 'vitest';
import { MailComponent, createMailComponent } from '../mailComponent';
import type {
    MailMessage,
    InboxResult,
    SendResult,
    StorageResult,
    MailComponentConfig,
} from '../../../index';

describe(MailComponent, () => {
    let component: MailComponent

    beforeEach(() => {
        component = new MailComponent({
            baseUrl: ''
        })
    })

    it('reply task mail', async () => {
        const initRendered = await component.render()
        console.log(initRendered.render())

        // component.handleToolCall()
    })
})