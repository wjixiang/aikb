// Mock for UUID module
const v4 = () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9);

module.exports = {
  v4,
  default: { v4 }
};