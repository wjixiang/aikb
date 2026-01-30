import { Entity, Nomenclature } from '../graphql';

/**
 * Test data for entity and nomenclature objects
 * This data is used for testing purposes
 */
export const testEntities: Entity[] = [
    {
        id: 'entity-001',
        definition: 'A medical condition characterized by inflammation of the heart muscle',
        nomenclature: [
            {
                name: 'Myocarditis',
                acronym: 'MYO',
                language: 'en'
            },
            {
                name: '心肌炎',
                acronym: null,
                language: 'zh'
            },
            {
                name: 'Myokarditis',
                acronym: null,
                language: 'de'
            }
        ]
    },
    {
        id: 'entity-002',
        definition: 'A chronic respiratory disease affecting the lungs',
        nomenclature: [
            {
                name: 'Asthma',
                acronym: 'AST',
                language: 'en'
            },
            {
                name: '哮喘',
                acronym: null,
                language: 'zh'
            },
            {
                name: 'Asma',
                acronym: null,
                language: 'es'
            }
        ]
    },
    {
        id: 'entity-003',
        definition: 'A metabolic disorder characterized by high blood sugar levels',
        nomenclature: [
            {
                name: 'Diabetes Mellitus',
                acronym: 'DM',
                language: 'en'
            },
            {
                name: '糖尿病',
                acronym: null,
                language: 'zh'
            },
            {
                name: 'Diabetes',
                acronym: null,
                language: 'es'
            }
        ]
    },
    {
        id: 'entity-004',
        definition: 'A cardiovascular disease where blood flow to the heart is restricted',
        nomenclature: [
            {
                name: 'Coronary Artery Disease',
                acronym: 'CAD',
                language: 'en'
            },
            {
                name: '冠状动脉疾病',
                acronym: null,
                language: 'zh'
            }
        ]
    },
    {
        id: 'entity-005',
        definition: 'A neurological disorder affecting movement and coordination',
        nomenclature: [
            {
                name: 'Parkinson\'s Disease',
                acronym: 'PD',
                language: 'en'
            },
            {
                name: '帕金森病',
                acronym: null,
                language: 'zh'
            },
            {
                name: 'Maladie de Parkinson',
                acronym: null,
                language: 'fr'
            }
        ]
    },
    {
        id: 'entity-006',
        definition: 'An autoimmune disease causing joint inflammation',
        nomenclature: [
            {
                name: 'Rheumatoid Arthritis',
                acronym: 'RA',
                language: 'en'
            },
            {
                name: '类风湿性关节炎',
                acronym: null,
                language: 'zh'
            }
        ]
    },
    {
        id: 'entity-007',
        definition: 'A condition characterized by persistent sadness and loss of interest',
        nomenclature: [
            {
                name: 'Depression',
                acronym: 'DEP',
                language: 'en'
            },
            {
                name: '抑郁症',
                acronym: null,
                language: 'zh'
            }
        ]
    },
    {
        id: 'entity-008',
        definition: 'A disorder characterized by high blood pressure',
        nomenclature: [
            {
                name: 'Hypertension',
                acronym: 'HTN',
                language: 'en'
            },
            {
                name: '高血压',
                acronym: null,
                language: 'zh'
            }
        ]
    },
    {
        id: 'entity-009',
        definition: 'A group of diseases characterized by uncontrolled cell growth',
        nomenclature: [
            {
                name: 'Cancer',
                acronym: 'CA',
                language: 'en'
            },
            {
                name: '癌症',
                acronym: null,
                language: 'zh'
            },
            {
                name: 'Cáncer',
                acronym: null,
                language: 'es'
            }
        ]
    },
    {
        id: 'entity-010',
        definition: 'A viral infection affecting the respiratory system',
        nomenclature: [
            {
                name: 'Influenza',
                acronym: 'FLU',
                language: 'en'
            },
            {
                name: '流感',
                acronym: null,
                language: 'zh'
            }
        ]
    }
];
