import { GraphQLClient, gql } from 'graphql-request';

describe('document e2e test', () => {
    const endpoint = 'http://localhost:3000/graphql'
    const graphQLClient = new GraphQLClient(endpoint, {});

    it('should create a document', async () => {
        const query = gql`
            mutation{
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: "test_topic"
                    content: "test_content"
                }) {
                    id
                }
            }
        `

        const response = await graphQLClient.request(query)
        console.log(response)
    });

    it('should update a document', async () => {
        // First, create a document to update
        const createQuery = gql`
            mutation{
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: "original_topic"
                    content: "original_content"
                }) {
                    id
                    topic
                    type
                    entities
                    record {
                        topic
                        content
                    }
                }
            }
        `

        const createResponse = await graphQLClient.request(createQuery)
        const documentId = createResponse.createDocument.id

        // Update the document
        const updateQuery = gql`
            mutation($documentId: String!) {
                updateDocument(input: {
                    documentId: $documentId
                    topic: "updated_topic"
                    content: "updated_content"
                    entities: ["updated_entity"]
                    type: relation
                }) {
                    id
                    topic
                    type
                    entities
                    record {
                        topic
                        content
                    }
                }
            }
        `

        const updateResponse = await graphQLClient.request(updateQuery, { documentId })

        expect(updateResponse.updateDocument).toBeDefined()
        expect(updateResponse.updateDocument.id).toBe(documentId)
        expect(updateResponse.updateDocument.topic).toBe("updated_topic")
        expect(updateResponse.updateDocument.type).toBe("relation")
        expect(updateResponse.updateDocument.entities).toEqual(["updated_entity"])
        expect(updateResponse.updateDocument.record).toBeDefined()
        expect(updateResponse.updateDocument.record.length).toBeGreaterThan(0)
        // Check that the latest record has the updated content
        expect(updateResponse.updateDocument.record[0].content).toBe("updated_content")
    });

    it('should update only topic without content', async () => {
        // First, create a document
        const createQuery = gql`
            mutation{
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: "original_topic"
                    content: "original_content"
                }) {
                    id
                    topic
                }
            }
        `

        const createResponse = await graphQLClient.request(createQuery)
        const documentId = createResponse.createDocument.id

        // Update only the topic
        const updateQuery = gql`
            mutation($documentId: String!) {
                updateDocument(input: {
                    documentId: $documentId
                    topic: "updated_topic_only"
                }) {
                    id
                    topic
                    record {
                        topic
                        content
                    }
                }
            }
        `

        const updateResponse = await graphQLClient.request(updateQuery, { documentId })

        expect(updateResponse.updateDocument).toBeDefined()
        expect(updateResponse.updateDocument.id).toBe(documentId)
        expect(updateResponse.updateDocument.topic).toBe("updated_topic_only")
        // Record should not be created when only topic is updated
        expect(updateResponse.updateDocument.record).toBeDefined()
    });
})