import { Provider } from '@nestjs/common';
import { LibraryService } from './library.service';
import { BibliographyModuleOptions } from './bibliography.interface';

export const BIBLIOGRAPHY_OPTIONS = 'BIBLIOGRAPHY_OPTIONS';

export function createBibliographyProviders(): Provider[] {
    return [
        {
            provide: LibraryService,
            useFactory: (options: BibliographyModuleOptions) => {
                return new LibraryService(options);
            },
            inject: [BIBLIOGRAPHY_OPTIONS],
        },
    ];
}
