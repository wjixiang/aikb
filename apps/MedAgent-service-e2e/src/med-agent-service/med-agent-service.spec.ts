import { randomUUID } from 'crypto'
import { GraphQLClient, gql } from 'graphql-request'
import { generateTestAccessToken } from 'testAuthHelper'

describe('MedAgent-service-e2e', () => {
  const endpoint = 'http://localhost:3000/graphql'
  const testAuthJWT = generateTestAccessToken(
    {
      sub: randomUUID(),
      email: 'wjixiang27@gmail.com'
    }
  )

  const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
      authorization: `Bearer ${testAuthJWT}`,
    },
  })
  it('should create a task', async () => {
    const query = gql`
      mutation CreateTask {
          createTask(input: {
            taskInput: "hypertension"
          }) {
              taskStatus
              id
          }
        }
      `
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data))
  })
})