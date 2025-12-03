import axios from 'axios';
import {
  CreateEntityDto,
  CreateAbstractDto,
} from 'apps/knowledgeBase-service/src/dto/create-entity.dto';

describe('create entity /api/entities', () => {
  it('should return a message', async () => {
    const data: CreateEntityDto = {
      nomenclature: [
        {
          name: 'test-entity1',
          language: 'en',
        },
      ],
      abstract: {
        description: 'test abstract',
      },
    };
    const res = await axios.post(`/api/entities`, data);

    expect(res.status).toBe(201);
    // expect(res.data).toEqual({ message: 'Hello API' });
  });
});
