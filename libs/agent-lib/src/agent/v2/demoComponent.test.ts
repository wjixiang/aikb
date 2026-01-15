import { describe, it, expect } from 'vitest';
import { DemoComponent } from './demoComponent';

describe('DemoComponent - Script Writing Guidance Feature', () => {
    let component: DemoComponent;

    beforeEach(() => {
        component = new DemoComponent();
    });

    describe('Script Writing Guidance', () => {
        it('should render with state initialization code', async () => {
            const context = await component.renderWithScriptSection();

            // Check that state initialization code is included
            expect(context).toContain('const search_box_state = {"search_pattern":""};');
            expect(context).toContain('const filter_state = {};');
        });

        it('should render with utility functions', async () => {
            const context = await component.renderWithScriptSection();

            // Check that utility functions are mentioned
            expect(context).toContain('Available utility functions:');
            expect(context).toContain('normalizeSearch');
            expect(context).toContain('validatePriceRange');
            expect(context).toContain('buildSearchQuery');
        });

        it('should include SCRIPT WRITING GUIDE section', async () => {
            const context = await component.renderWithScriptSection();

            expect(context).toContain('SCRIPT WRITING GUIDE');
            expect(context).toContain('STATE INITIALIZATION');
        });
    });

    describe('Utility Functions in Scripts', () => {
        it('should allow using normalizeSearch utility in script', async () => {
            const result = await component.executeScript(`
                const normalized = normalizeSearch("  HELLO WORLD  ");
                search_box_state.search_pattern = normalized;
            `);

            expect(result.success).toBe(true);
            expect(component.getSearchResult()).toContain('hello world');
        });

        it('should allow using validatePriceRange utility in script', async () => {

            const result = await component.executeScript(`
                validatePriceRange(10, 100);
                filter_state.min_price = 10;
                filter_state.max_price = 100;
            `);

            expect(result.success).toBe(true);
            expect(component.getFilteredResults()).toContain('min_price":10');
            expect(component.getFilteredResults()).toContain('max_price":100');
        });

        it('should allow using buildSearchQuery utility in script', async () => {
            const result = await component.executeScript(`
                const query = buildSearchQuery("laptop", { category: "electronics", min_price: 500 });
                search_box_state.search_pattern = query;
            `);

            expect(result.success).toBe(true);
            expect(component.getSearchResult()).toContain('laptop category:electronics min:500');
        });

        it('should handle utility function errors gracefully', async () => {
            const result = await component.executeScript(`
                try {
                    validatePriceRange(100, 50); // Invalid: min > max
                } catch (e) {
                    search_box_state.search_pattern = "error: " + e.message;
                }
            `);

            expect(result.success).toBe(true);
            expect(component.getSearchResult()).toContain('error:');
        });
    });

    describe('Complex Script Scenarios', () => {
        it('should combine multiple utility functions in one script', async () => {
            const result = await component.executeScript(`
                // Normalize and build query
                const normalized = normalizeSearch("  Gaming Laptop  ");
                const query = buildSearchQuery(normalized, { category: "computers" });
                search_box_state.search_pattern = query;
            `);

            expect(result.success).toBe(true);
            expect(component.getSearchResult()).toContain('gaming laptop category:computers');
        });

        it('should support conditional logic with utilities', async () => {
            const result = await component.executeScript(`
                const pattern = "  expensive item  ";
                const normalized = normalizeSearch(pattern);
                
                if (normalized.includes("expensive")) {
                    filter_state.min_price = 1000;
                    filter_state.max_price = 5000;
                } else {
                    filter_state.min_price = 0;
                    filter_state.max_price = 100;
                }
            `);

            expect(result.success).toBe(true);
            expect(component.getFilteredResults()).toContain('min_price":1000');
            expect(component.getFilteredResults()).toContain('max_price":5000');
        });
    });

    describe('End-to-End Demo Scenario', () => {
        it('should demonstrate complete workflow with utilities', async () => {


            // Step 1: User searches for something
            await component.executeScript(`
                const normalized = normalizeSearch("  MacBook Pro  ");
                search_box_state.search_pattern = normalized;
            `);
            expect(component.getSearchResult()).toContain('macbook pro');

            // Step 2: Apply filters
            await component.executeScript(`
                validatePriceRange(1000, 3000);
                filter_state.category = "computers";
                filter_state.min_price = 1000;
                filter_state.max_price = 3000;
            `);
            expect(component.getFilteredResults()).toContain('computers');

            // Step 3: Build final query
            await component.executeScript(`
                const query = buildSearchQuery(search_box_state.search_pattern, filter_state);
                search_box_state.search_pattern = query;
            `);
            expect(component.getSearchResult()).toContain('category:computers');

        });
    });
});
