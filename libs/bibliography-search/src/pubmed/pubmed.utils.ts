import type { RetrivalStrategy } from './pubmed.types.js';

export function renderRetrivalStrategy(strategy: RetrivalStrategy): string {
    const parts: string[] = [];

    // Handle field constraints with OR relation
    if (strategy.field && strategy.field.length > 0) {
        const fieldParts = strategy.field.map(field => {
            if (field === "All Fields") {
                return strategy.term;
            }
            return `${field}[${strategy.term}]`;
        });

        if (fieldParts.length === 1) {
            parts.push(fieldParts[0]);
        } else {
            parts.push(`(${fieldParts.join(' OR ')})`);
        }
    }

    // Handle AND operators
    if (strategy.AND && strategy.AND.length > 0) {
        const andParts = strategy.AND.map(s => renderRetrivalStrategy(s));
        if (andParts.length > 0) {
            const andStr = andParts.join(' AND ');
            parts.push(andStr.length > 1 ? `(${andStr})` : andStr);
        }
    }

    // Handle OR operators
    if (strategy.OR && strategy.OR.length > 0) {
        const orParts = strategy.OR.map(s => renderRetrivalStrategy(s));
        if (orParts.length > 0) {
            const orStr = orParts.join(' OR ');
            parts.push(orStr.length > 1 ? `(${orStr})` : orStr);
        }
    }

    // Handle NOT operators
    if (strategy.NOT && strategy.NOT.length > 0) {
        const notParts = strategy.NOT.map(s => renderRetrivalStrategy(s));
        if (notParts.length > 0) {
            const notStr = notParts.join(' NOT ');
            parts.push(notStr.length > 1 ? `(${notStr})` : notStr);
        }
    }

    // Combine all parts with AND between top-level components
    if (parts.length === 0) {
        return strategy.term || '';
    }

    return parts.join(' AND ');
}
