import { Module, DynamicModule, Provider } from '@nestjs/common';
import { LibraryService } from './library.service';
import {
    BibliographyModuleAsyncOptions,
    BibliographyModuleOptions,
} from './bibliography.interface';
import {
    BIBLIOGRAPHY_OPTIONS,
    createBibliographyProviders,
} from './bibliography.providers';

@Module({})
export class BibliographyModule {
    static register(options: BibliographyModuleOptions): DynamicModule {
        return {
            module: BibliographyModule,
            providers: [
                {
                    provide: BIBLIOGRAPHY_OPTIONS,
                    useValue: options,
                },
                ...createBibliographyProviders(),
            ],
            exports: [LibraryService],
        };
    }

    static registerAsync(
        options: BibliographyModuleAsyncOptions,
    ): DynamicModule {
        const asyncProviders = this.createAsyncProviders(options);
        return {
            module: BibliographyModule,
            imports: options.imports || [],
            providers: [...asyncProviders, ...createBibliographyProviders()],
            exports: [LibraryService],
        };
    }

    private static createAsyncProviders(
        options: BibliographyModuleAsyncOptions,
    ): Provider[] {
        if (options.useExisting) {
            return [
                {
                    provide: BIBLIOGRAPHY_OPTIONS,
                    useExisting: options.useExisting,
                },
            ];
        }

        if (options.useFactory) {
            return [
                {
                    provide: BIBLIOGRAPHY_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ];
        }

        // useClass
        if (options.useClass) {
            return [
                {
                    provide: BIBLIOGRAPHY_OPTIONS,
                    useClass: options.useClass,
                },
            ];
        }

        return [];
    }
}
