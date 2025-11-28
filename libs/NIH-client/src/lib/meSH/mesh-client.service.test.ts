
import { meSHClient } from './mesh-client.service'
import { Test } from '@nestjs/testing';
import {MeShClientModule} from './meSH-client.module'
import { INestApplication } from '@nestjs/common';

describe(meSHClient, ()=>{
    let app: INestApplication;
    let meSHClientService: meSHClient;
    beforeAll(async ()=>{
       const moduleRef = await Test.createTestingModule({
        imports: [MeShClientModule]
       }).compile()
       app = moduleRef.createNestApplication()
       meSHClientService = moduleRef.get(meSHClient)
       await app.init()
    })

    it('query single term', async()=>{
        await meSHClientService.searchSingleTerm('Asprin')
    })
})