import { listPubmedAnnualIndexViaFtp, PubmedMirror } from './pubmed-mirror';

describe('pubmedMirror', () => {
  it.skip('integrated: should list annual index files via ftp', async () => {
    const files = await listPubmedAnnualIndexViaFtp()
    expect(files).toBeDefined()
    expect(files.length).toBeGreaterThan(0)
  }, 30000)

  it.only('integrated: should sync specific file to oss', async () => {
    const res = await PubmedMirror.syncFile('pubmed26n1090.xml.gz')
  }, 99999)
});
