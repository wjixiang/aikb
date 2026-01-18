import { Permission, State, StatefulComponent } from './statefulComponent';
import { proxy, subscribe } from 'valtio';
import * as z from 'zod';

/**
 * Demo component showcasing the script writing guidance feature
 * This component provides utility functions that can be used in LLM scripts
 */
export class DemoComponent extends StatefulComponent {
    protected override states: Record<string, State> = {
        search_box_state: {
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
        subscribe(this.states['search_box_state'].state, async () => {
            console.log(`search_box_state changed to`, this.states['search_box_state'].state);
            const state = this.states['search_box_state'].state as { search_pattern: string };
            this.state.search_result = `Search results for: ${state.search_pattern}`;
        });

        // Subscribe to filter_state changes
        subscribe(this.states['filter_state'].state, async () => {
            console.log(`filter_state changed to`, this.states['filter_state'].state);
            this.state.filtered_results = `Filtered by: ${JSON.stringify(this.states['filter_state'].state)}`;
        });
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
