/**
 * My Expert Workspace
 *
 * 运行时工作空间 - 用于注册组件
 *
 * 如果不需要自定义输入/输出处理，可以直接使用 createSimpleExpertConfig
 * 此时此文件可选
 */

import { VirtualWorkspace } from '../../index.js';
// import { MyComponent } from './components/MyComponent.js';

/**
 * MyExpertWorkspace - 运行时工作空间
 *
 * 继承 VirtualWorkspace 以获得完整的运行时能力
 * 在构造函数中注册组件
 *
 * 使用方式：
 * const workspace = new MyExpertWorkspace();
 */
export class MyExpertWorkspace extends VirtualWorkspace {
  constructor() {
    super({ id: 'my-expert', name: 'My Expert' });

    // 注册组件（可选）
    // this.registerComponent('myComponent', new MyComponent());
  }
}
