import { GraphQLClient, gql } from 'graphql-request';

describe('GET /api', () => {
  const endpoint = 'http://localhost:3000/graphql'
  const graphQLClient = new GraphQLClient(endpoint, {});

  it('should return a message', async () => {
    const query = gql`
    {
      entity {
        id
      }
    }
    `

    const response = await graphQLClient.request(query)
    console.log(response)
    // const res = await axios.get(`/api`);

    // expect(res.status).toBe(200);
    // expect(res.data).toEqual({ message: 'Hello API' });
  });

  it('should create an entity', async () => {
    const response = await graphQLClient.request(gql`
      mutation {
        createEntity(input: {
          definition: "test",
          nomenclature: [
            {
              name: "Test Entity",
              language: "en"
            }
          ]
        }) {
          id
          definition
        }
      }
    `)
    console.log(response)
  })
});
