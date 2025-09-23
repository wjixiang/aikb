import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(() => {
    // Create instances manually
    appService = new AppService(null as any);
    appController = new AppController(appService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      // Ensure the service is properly injected
      expect(appService).toBeDefined();
      expect(appController).toBeDefined();
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
