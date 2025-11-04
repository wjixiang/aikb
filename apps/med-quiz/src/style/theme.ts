// styles/theme.ts
export const lightTheme = {
  colors: {
    background: '#fff',
    text: '#333',
    subText: '#555',
    border: '#ddd',
    shadow: 'rgba(0,0,0,0.1)',
    option: {
      border: '#ccc',
      selectedBorder: '#1890ff',
      background: '#fff',
      selectedBackground: '#e6f7ff',
      hoverBackground: '#f0f0f0',
    },
    button: {
      background: '#1890ff',
      text: '#fff',
    },
    result: {
      correct: 'green',
      incorrect: 'red',
    },
  },
};

export const darkTheme = {
  colors: {
    background: '#1a1a1a',
    text: '#e0e0e0',
    subText: '#b0b0b0',
    border: '#333',
    shadow: 'rgba(0,0,0,0.3)',
    option: {
      border: '#444',
      selectedBorder: '#1890ff',
      background: '#2d2d2d',
      selectedBackground: '#153450',
      hoverBackground: '#3d3d3d',
    },
    button: {
      background: '#1890ff',
      text: '#fff',
    },
    result: {
      correct: '#4caf50',
      incorrect: '#f44336',
    },
  },
};
