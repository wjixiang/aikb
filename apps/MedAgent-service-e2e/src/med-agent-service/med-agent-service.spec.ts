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

  it('basic workflow', async () => {
    const creatTaskquery = gql`
      mutation CreateTask {
          createTask(input: {
            taskInput: "动作电位的定义"
          }) {
              taskStatus
              id
          }
        }
      `
    const createTaskdata = await graphQLClient.request(creatTaskquery)
    console.log(JSON.stringify(createTaskdata))

    // Query the task
    const queryTheTask = gql`
        {
          listTaskInfo {
            id
            taskStatus
            taskInput
          }
        }
      `
    const taskQuerydata = await graphQLClient.request(queryTheTask)
    console.log(JSON.stringify(taskQuerydata))

    // Start the task
    const query = gql`
      mutation StartTask {
          startTask(input: {
            taskId: "${createTaskdata.createTask.id}"
          }) {
            isSuccess
            failedReason
          }
        }
      `
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data))
    const sleep = (ms: number): Promise<void> => {
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    await sleep(60000)
  }, 90000)

  it.skip('should create a task', async () => {
    const query = gql`
      mutation CreateTask {
          createTask(input: {
            taskInput: "动作电位的定义"
          }) {
              taskStatus
              id
          }
        }
      `
    const data = await graphQLClient.request(query)
    console.log(JSON.stringify(data))
  })

  it.skip('query a task', async () => {
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

  it.skip('start a task', async () => {
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
    const sleep = (ms: number): Promise<void> => {
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    await sleep(60000)
  }, 90000)


})