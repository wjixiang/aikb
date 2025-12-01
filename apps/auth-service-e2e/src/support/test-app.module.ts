import { Module } from '@nestjs/common';
import { TestAuthLibModule } from './test-auth-lib.module';

@Module({
  imports: [TestAuthLibModule],
})
export class TestAppModule {}
