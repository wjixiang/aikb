import { Permission, PublicState, StatefulComponent, StateType } from './statefulComponent';
import { proxy, subscribe } from 'valtio';
import * as z from 'zod';

/**
 * Demo component showcasing the script writing guidance feature
 * This component provides utility functions that can be used in LLM scripts
 */
export class DemoComponent extends StatefulComponent {
    protected override publicStates: Record<string, PublicState> = {
        search_box_state: {
            type: StateType.public,
            permission: Permission.rw,
            schema: z.object({
                search_pattern: z.string().max(300)
            }),
            sideEffectsDesc: `Any changes of this state object will automatically trigger searching action and refresh search results`,
            state: proxy<{ search_pattern: string }>({
                search_pattern: ''
            })
        },
        filter_state: {
            type: StateType.public,
            permission: Permission.rw,
            schema: z.object({
                category: z.string().optional(),
                min_price: z.number().optional(),
                max_price: z.number().optional()
            }),
            sideEffectsDesc: `Changes will filter the search results`,
            state: proxy<{ category?: string; min_price?: number; max_price?: number }>({})
        }
    };

    state = {
        search_result: '',
        filtered_results: ''
    };

    constructor() {
        super();
        // Subscribe to search_box_state changes
        subscribe(this.publicStates['search_box_state'].state, async () => {
            console.log(`search_box_state changed to`, this.publicStates['search_box_state'].state);
            const state = this.publicStates['search_box_state'].state as { search_pattern: string };
            this.state.search_result = `Search results for: ${state.search_pattern}`;
        });

        // Subscribe to filter_state changes
        subscribe(this.publicStates['filter_state'].state, async () => {
            console.log(`filter_state changed to`, this.publicStates['filter_state'].state);
            this.state.filtered_results = `Filtered by: ${JSON.stringify(this.publicStates['filter_state'].state)}`;
        });
    }

    /**
     * Override to provide utility functions for script execution
     */
    protected override getScriptUtilities(): Record<string, Function> {
        return {
            /**
             * Normalize search pattern by trimming and lowercasing
             */
            normalizeSearch: (pattern: string) => {
                return pattern.trim().toLowerCase();
            },
            /**
             * Validate price range
             */
            validatePriceRange: (min: number, max: number) => {
                if (min < 0 || max < 0) {
                    throw new Error('Prices cannot be negative');
                }
                if (min > max) {
                    throw new Error('Min price cannot be greater than max price');
                }
                return true;
            },
            /**
             * Generate search query with filters
             */
            buildSearchQuery: (pattern: string, filters: any) => {
                let query = pattern;
                if (filters.category) {
                    query += ` category:${filters.category}`;
                }
                if (filters.min_price !== undefined) {
                    query += ` min:${filters.min_price}`;
                }
                if (filters.max_price !== undefined) {
                    query += ` max:${filters.max_price}`;
                }
                return query;
            }
        };
    }

    /**
     * Get current search result
     */
    getSearchResult(): string {
        return this.state.search_result;
    }

    /**
     * Get current filtered results
     */
    getFilteredResults(): string {
        return this.state.filtered_results;
    }
}
