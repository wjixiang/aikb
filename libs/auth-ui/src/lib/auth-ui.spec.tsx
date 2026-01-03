import { render } from '@testing-library/react';

import AuthUi from './auth-ui';

describe('AuthUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<AuthUi />);
    expect(baseElement).toBeTruthy();
  });
});
