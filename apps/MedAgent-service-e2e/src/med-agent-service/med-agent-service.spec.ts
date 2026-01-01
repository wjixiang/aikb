import { randomUUID } from 'crypto'
import { GraphQLClient, gql } from 'graphql-request'
import { generateTestAccessToken } from 'testAuthHelper'

describe('MedAgent-service-e2e', () => {
  const endpoint = 'http://localhost:3000/graphql'
  const testAuthJWT = generateTestAccessToken(
    {
      sub: "abae8ef2-93b3-466d-8b97-5e2011d3e28d",
      email: 'test_user@gmail.com'
    }
  )

  const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
      authorization: `Bearer ${testAuthJWT}`,
    },
  })
  it.skip('should create a task', async () => {
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

  it('query a task', async () => {
    const query = gql`
        {
          listTaskInfo {
            id
            taskStatus
            taskInput
          }
        }
      `
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data))
  }, 30000)

  it('start a task', async () => {
    const query = gql`
      mutation StartTask {
          startTask(input: {
            taskId: "78d34af3-5573-4bd9-ab70-f0c04641ee8f"
          }) {
            isSuccess
            failedReason
          }
        }
      `
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data))
    setTimeout(() => { }, 10000)
  }, 30000)


})