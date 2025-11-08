// styles/styled.d.ts
import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      background: string;
      text: string;
      subText: string;
      border: string;
      shadow: string;
      option: {
        border: string;
        selectedBorder: string;
        background: string;
        selectedBackground: string;
        hoverBackground: string;
      };
      button: {
        background: string;
        text: string;
      };
      result: {
        correct: string;
        incorrect: string;
      };
    };
  }
}
