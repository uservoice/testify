import { TestClass } from '@/fixtures';

describe('testify', () => {
  it('can import .ts files, mock w/sinon and test the dom', () => {
    const instance = new TestClass();
    sinon.spy(instance, 'createDom');
    instance.createDom();
    const testDiv = document.body.querySelector('#test-div');
    expect(instance.createDom).called;
    expect(testDiv).to.exist;
    expect(testDiv).attr('href', '#');
  });
  it('can require .ts files and augment the test environment', () => {
    expect(window.SomeGlobal).to.eq("Hello World")
  });
});
