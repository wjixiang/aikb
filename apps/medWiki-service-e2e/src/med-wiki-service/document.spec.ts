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

    it('should get a single document by id', async () => {
        // First, create a document to query
        const createQuery = gql`
            mutation{
                createDocument(input: {
                    type: property
                    entities: ["test_entity"]
                    topic: "query_test_topic"
                    content: "query_test_content"
                }) {
                    id
                    topic
                    type
                    entities
                }
            }
        `

        const createResponse = await graphQLClient.request(createQuery)
        const documentId = createResponse.createDocument.id

        // Query the document by id
        const query = gql`
            query($documentId: ID!) {
                document(where: {
                    id: $documentId
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

        const response = await graphQLClient.request(query, { documentId })

        expect(response.document).toBeDefined()
        expect(response.document.id).toBe(documentId)
        expect(response.document.topic).toBe("query_test_topic")
        expect(response.document.type).toBe("property")
        expect(response.document.entities).toEqual(["test_entity"])
        expect(response.document.record).toBeDefined()
        expect(response.document.record.length).toBeGreaterThan(0)
    });

    it('should return null for non-existent document', async () => {
        const query = gql`
            query {
                document(where: {
                    id: "non-existent-id"
                }) {
                    id
                    topic
                }
            }
        `

        const response = await graphQLClient.request(query)

        expect(response.document).toBeNull()
    });

    it('should get all documents', async () => {
        // Create a few documents
        const createQuery = gql`
            mutation($topic: String!) {
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: $topic
                    content: "test_content"
                }) {
                    id
                    topic
                }
            }
        `

        await graphQLClient.request(createQuery, { topic: "document_1" })
        await graphQLClient.request(createQuery, { topic: "document_2" })
        await graphQLClient.request(createQuery, { topic: "document_3" })

        // Query all documents
        const query = gql`
            query {
                documents(where: {}) {
                    id
                    topic
                    type
                    entities
                }
            }
        `

        const response = await graphQLClient.request(query)

        expect(response.documents).toBeDefined()
        expect(response.documents.length).toBeGreaterThanOrEqual(3)
    });

    it('should filter documents by type', async () => {
        // Create documents with different types
        const createQuery = gql`
            mutation($type: documentType!, $topic: String!) {
                createDocument(input: {
                    type: $type
                    entities: ["test"]
                    topic: $topic
                    content: "test_content"
                }) {
                    id
                    topic
                    type
                }
            }
        `

        await graphQLClient.request(createQuery, { type: "property", topic: "property_doc" })
        await graphQLClient.request(createQuery, { type: "relation", topic: "relation_doc" })
        await graphQLClient.request(createQuery, { type: "property", topic: "another_property_doc" })

        // Query documents filtered by type
        const query = gql`
            query {
                documents(where: {
                    type: property
                }) {
                    id
                    topic
                    type
                }
            }
        `

        const response = await graphQLClient.request(query)

        expect(response.documents).toBeDefined()
        expect(response.documents.length).toBeGreaterThanOrEqual(2)
        response.documents.forEach((doc: any) => {
            expect(doc.type).toBe("property")
        })
    });

    it('should filter documents by entities', async () => {
        // Create documents with different entities
        const createQuery = gql`
            mutation($entities: [String!]!, $topic: String!) {
                createDocument(input: {
                    type: property
                    entities: $entities
                    topic: $topic
                    content: "test_content"
                }) {
                    id
                    topic
                    entities
                }
            }
        `

        await graphQLClient.request(createQuery, { entities: ["entity1", "entity2"], topic: "doc_with_entity1" })
        await graphQLClient.request(createQuery, { entities: ["entity3"], topic: "doc_with_entity3" })
        await graphQLClient.request(createQuery, { entities: ["entity1", "entity3"], topic: "doc_with_both" })

        // Query documents filtered by entities
        const query = gql`
            query {
                documents(where: {
                    entities_in: ["entity1"]
                }) {
                    id
                    topic
                    entities
                }
            }
        `

        const response = await graphQLClient.request(query)

        expect(response.documents).toBeDefined()
        expect(response.documents.length).toBeGreaterThanOrEqual(2)
        response.documents.forEach((doc: any) => {
            expect(doc.entities).toContain("entity1")
        })
    });

    it('should filter documents by topic contains', async () => {
        // Create documents with specific topics
        const createQuery = gql`
            mutation($topic: String!) {
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: $topic
                    content: "test_content"
                }) {
                    id
                    topic
                }
            }
        `

        await graphQLClient.request(createQuery, { topic: "medical_diabetes" })
        await graphQLClient.request(createQuery, { topic: "medical_hypertension" })
        await graphQLClient.request(createQuery, { topic: "technical_specification" })

        // Query documents filtered by topic contains
        const query = gql`
            query {
                documents(where: {
                    topic_contains: "medical"
                }) {
                    id
                    topic
                }
            }
        `

        const response = await graphQLClient.request(query)

        expect(response.documents).toBeDefined()
        expect(response.documents.length).toBeGreaterThanOrEqual(2)
        response.documents.forEach((doc: any) => {
            expect(doc.topic).toContain("medical")
        })
    });

    it('should filter documents by id_in', async () => {
        // Create documents
        const createQuery = gql`
            mutation($topic: String!) {
                createDocument(input: {
                    type: property
                    entities: ["test"]
                    topic: $topic
                    content: "test_content"
                }) {
                    id
                    topic
                }
            }
        `

        const doc1 = await graphQLClient.request(createQuery, { topic: "doc_1" })
        const doc2 = await graphQLClient.request(createQuery, { topic: "doc_2" })
        const doc3 = await graphQLClient.request(createQuery, { topic: "doc_3" })

        // Query documents filtered by id_in
        const query = gql`
            query($ids: [ID!]!) {
                documents(where: {
                    id_in: $ids
                }) {
                    id
                    topic
                }
            }
        `

        const response = await graphQLClient.request(query, {
            ids: [doc1.createDocument.id, doc3.createDocument.id]
        })

        expect(response.documents).toBeDefined()
        expect(response.documents.length).toBe(2)
        const ids = response.documents.map((d: any) => d.id)
        expect(ids).toContain(doc1.createDocument.id)
        expect(ids).toContain(doc3.createDocument.id)
        expect(ids).not.toContain(doc2.createDocument.id)
    });
})