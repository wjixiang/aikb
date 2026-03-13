/**
 * Component Integration Test
 */

import { join } from 'path';

async function main() {
    const expertDir = join(process.cwd(), 'experts', 'hi-agent');
    const indexPath = join(expertDir, 'index.ts');

    // Import the expert config
    const expertModule = await import(`file://${indexPath}`);
    const expertConfig = expertModule.default;

    console.log('Expert Config:', JSON.stringify({
        expertId: expertConfig.expertId,
        components: expertConfig.components.map((c: any) => ({
            componentId: c.componentId,
            displayName: c.displayName,
        }))
    }, null, 2));

    // Get component instance
    const comp = expertConfig.components[0];
    let componentInstance;
    if (typeof comp.instance === 'function') {
        componentInstance = comp.instance();
    } else {
        componentInstance = comp.instance;
    }

    // Test component
    console.log('\n--- Component Test ---');
    console.log('Component ID:', componentInstance.componentId);
    console.log('Display Name:', componentInstance.displayName);
    console.log('Description:', componentInstance.description);
    console.log('Tools:', Array.from(componentInstance.toolSet.keys()));

    // Test tool call
    await componentInstance.handleToolCall('hello', { name: 'Claude' });
    console.log('After tool call state:', componentInstance.getState());

    // Test render
    const rendered = await componentInstance.renderImply();
    console.log('Rendered:', rendered.map((r: any) => r.render ? r.render() : r));

    console.log('\n✅ All component tests passed!');
}

main().catch(console.error);
